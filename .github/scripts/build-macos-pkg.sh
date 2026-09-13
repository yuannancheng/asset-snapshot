#!/usr/bin/env bash
#
# 用已构建的 macOS .app 生成 .pkg 安装包（Tauri 本身不产出 pkg）。
#
# 用法：
#   .github/scripts/build-macos-pkg.sh                    # 自动查找 target/*/release/bundle/macos/*.app
#   APP_PATH=/path/to/资产快照.app .github/scripts/build-macos-pkg.sh
#
# 可选环境变量（都为空时只生成未签名安装包）：
#   APPLE_INSTALLER_SIGNING_IDENTITY  "Developer ID Installer" 证书名，用于 productsign 签名
#   APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID  公证（notarytool）凭据，需先签名
#
set -euo pipefail

# 注意：macOS 上 /bin/bash 是 3.2，在 C locale 下会把 "$VAR" 后面紧跟的多字节字符
# 当成变量名的一部分（报 unbound variable）。变量后面直接跟中文或全角符号时，
# 一律写成 "${VAR}"。

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m错误：%s\033[0m\n' "$*" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
MACOS_DIR="$TAURI_DIR/macos"
CONFIG="$TAURI_DIR/tauri.conf.json"

[ "$(uname -s)" = "Darwin" ] || die "pkg 安装包只能在 macOS 上构建（需要 pkgbuild / productbuild）。"
for tool in pkgbuild productbuild lipo; do
  command -v "$tool" >/dev/null 2>&1 || die "缺少 ${tool}，请先安装 Xcode Command Line Tools（xcode-select --install）。"
done
[ -f "$MACOS_DIR/distribution.xml" ] || die "缺少 $MACOS_DIR/distribution.xml"
[ -f "$MACOS_DIR/welcome.html" ] || die "缺少 $MACOS_DIR/welcome.html"

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
PKG_ID="$(read_config "$CONFIG" identifier)"
[ -n "$APP_NAME" ] || die "无法从 tauri.conf.json 读取 productName"
[ -n "$VERSION" ] || die "无法从 tauri.conf.json 读取 version"
[ -n "$PKG_ID" ] || die "无法从 tauri.conf.json 读取 identifier"
PKG_ID="$PKG_ID.pkg"

find_app_bundle() {
  local dir app
  for dir in "$TAURI_DIR/target/release/bundle/macos" "$TAURI_DIR"/target/*/release/bundle/macos; do
    [ -d "$dir" ] || continue
    app="$(find "$dir" -maxdepth 1 -name '*.app' -print 2>/dev/null | sed -n 1p)"
    if [ -n "$app" ]; then
      printf '%s\n' "$app"
      return 0
    fi
  done
  return 1
}

if [ -n "${APP_PATH:-}" ]; then
  APP_PATH="$(cd "$(dirname "$APP_PATH")" && pwd)/$(basename "$APP_PATH")"
else
  APP_PATH="$(find_app_bundle)" || die "找不到 .app，请先执行：npm run tauri -- build --bundles app"
fi
[ -d "$APP_PATH/Contents" ] || die "不是有效的 .app：$APP_PATH"

APP_BIN="$(find "$APP_PATH/Contents/MacOS" -maxdepth 1 -type f -print 2>/dev/null | sed -n 1p)"
[ -n "$APP_BIN" ] || die "在 $APP_PATH/Contents/MacOS 中找不到可执行文件"

ARCHS="$(lipo -archs "$APP_BIN")"
case "$ARCHS" in
  *arm64*x86_64* | *x86_64*arm64*) HOST_ARCH="arm64,x86_64"; NAME_ARCH="universal" ;;
  *arm64*) HOST_ARCH="arm64"; NAME_ARCH="arm64" ;;
  *x86_64*) HOST_ARCH="x86_64"; NAME_ARCH="x86" ;;
  *) HOST_ARCH="arm64,x86_64"; NAME_ARCH="universal" ;;
esac

MIN_OS="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$APP_PATH/Contents/Info.plist" 2>/dev/null || true)"
[ -n "$MIN_OS" ] || MIN_OS="10.15"

BUNDLE_ROOT="$(dirname "$(dirname "$APP_PATH")")"
OUT_DIR="$BUNDLE_ROOT/pkg"
# 命名规范：应用名_版本号_系统名_架构名.后缀
OUT_PKG="$OUT_DIR/${APP_NAME}_${VERSION}_macOS_${NAME_ARCH}.pkg"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/asset-snapshot-pkg.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

log "应用：$APP_PATH"
log "版本：${VERSION}（${NAME_ARCH}，最低系统版本 ${MIN_OS}）"

log "打包组件包"
pkgbuild \
  --component "$APP_PATH" \
  --install-location /Applications \
  --identifier "$PKG_ID" \
  --version "$VERSION" \
  --ownership recommended \
  "$WORK_DIR/component.pkg"

RES_DIR="$WORK_DIR/resources"
mkdir -p "$RES_DIR"
cp "$PROJECT_ROOT/LICENSE" "$RES_DIR/license.txt"
sed -e "s|__VERSION__|$VERSION|g" "$MACOS_DIR/welcome.html" > "$RES_DIR/welcome.html"
sed \
  -e "s|__VERSION__|$VERSION|g" \
  -e "s|__PKG_ID__|$PKG_ID|g" \
  -e "s|__HOST_ARCH__|$HOST_ARCH|g" \
  -e "s|__MIN_OS__|$MIN_OS|g" \
  "$MACOS_DIR/distribution.xml" > "$WORK_DIR/distribution.xml"

log "生成安装包 $OUT_PKG"
mkdir -p "$OUT_DIR"
productbuild \
  --distribution "$WORK_DIR/distribution.xml" \
  --resources "$RES_DIR" \
  --package-path "$WORK_DIR" \
  "$OUT_PKG"

if [ -n "${APPLE_INSTALLER_SIGNING_IDENTITY:-}" ]; then
  log "签名安装包（${APPLE_INSTALLER_SIGNING_IDENTITY}）"
  productsign --sign "$APPLE_INSTALLER_SIGNING_IDENTITY" "$OUT_PKG" "$OUT_PKG.signed"
  mv "$OUT_PKG.signed" "$OUT_PKG"
else
  log "未设置 APPLE_INSTALLER_SIGNING_IDENTITY，跳过签名"
fi

if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
  if [ -z "${APPLE_INSTALLER_SIGNING_IDENTITY:-}" ]; then
    die "公证需要先签名安装包，请设置 APPLE_INSTALLER_SIGNING_IDENTITY。"
  fi
  log "提交公证"
  xcrun notarytool submit "$OUT_PKG" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
  xcrun stapler staple "$OUT_PKG"
else
  log "未提供公证凭据，跳过公证"
fi

log "完成：$OUT_PKG"
log "校验：pkgutil --check-signature \"$OUT_PKG\""
