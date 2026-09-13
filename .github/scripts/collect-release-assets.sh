#!/usr/bin/env bash
#
# 把 Tauri 构建出的安装包收集到 release-assets/，并按发布命名规范重命名：
#
#   应用名_版本号_系统名_架构名.后缀
#
# 例如：asset-snapshot_0.3.5_Linux_x86.deb
#
# 用法：
#   .github/scripts/collect-release-assets.sh <系统名> <架构名>
#   .github/scripts/collect-release-assets.sh Linux x86
#
# 产物目录：<项目根>/release-assets/
#
set -euo pipefail

# 注意：macOS 上 /bin/bash 是 3.2，在 C locale 下会把 "$VAR" 后面紧跟的多字节字符
# 当成变量名的一部分（报 unbound variable）。变量后面直接跟中文或全角符号时，
# 一律写成 "${VAR}"。

log() { printf '==> %s\n' "$*"; }
die() { printf '错误：%s\n' "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
CONFIG="$TAURI_DIR/tauri.conf.json"

SYSTEM_NAME="${1:-}"
ARCH_NAME="${2:-}"
[ -n "$SYSTEM_NAME" ] || die "缺少系统名参数，用法：collect-release-assets.sh <系统名> <架构名>"
[ -n "$ARCH_NAME" ] || die "缺少架构名参数，用法：collect-release-assets.sh <系统名> <架构名>"

# 读取 tauri.conf.json 里的顶层字符串字段
read_config() {
  awk -v key="$2" '
    index($0, "\"" key "\"") {
      line = $0
      sub(/^[^:]*:[[:space:]]*"/, "", line)
      sub(/".*$/, "", line)
      print line
      exit
    }' "$1"
}

APP_NAME="$(read_config "$CONFIG" productName)"
VERSION="$(read_config "$CONFIG" version)"
[ -n "$APP_NAME" ] || die "无法从 tauri.conf.json 读取 productName"
[ -n "$VERSION" ] || die "无法从 tauri.conf.json 读取 version"

OUT_DIR="$PROJECT_ROOT/release-assets"
mkdir -p "$OUT_DIR"

# Tauri 的 bundle 目录可能是 target/release/bundle/<类型>/，
# 也可能带 target triple：target/<triple>/release/bundle/<类型>/
collect() {
  local sub_dir="$1" ext="$2" dir src dest
  for dir in "$TAURI_DIR"/target/release/bundle "$TAURI_DIR"/target/*/release/bundle; do
    [ -d "$dir/$sub_dir" ] || continue
    src="$(find "$dir/$sub_dir" -maxdepth 1 -type f -name "*$ext" -print | sed -n 1p)"
    if [ -n "$src" ]; then
      dest="$OUT_DIR/${APP_NAME}_${VERSION}_${SYSTEM_NAME}_${ARCH_NAME}${ext}"
      cp "$src" "$dest"
      log "收集 $(basename "$src") -> $(basename "$dest")"
      return 0
    fi
  done
  return 1
}

# 子目录:扩展名，覆盖当前工作流用到的全部安装包类型
COLLECTED=0
for entry in deb:.deb appimage:.AppImage dmg:.dmg pkg:.pkg nsis:.exe; do
  if collect "${entry%%:*}" "${entry##*:}"; then
    COLLECTED=$((COLLECTED + 1))
  fi
done

[ "$COLLECTED" -gt 0 ] || die "没有找到任何安装包，请确认构建是否成功"
log "已收集 ${COLLECTED} 个安装包到 release-assets/"
