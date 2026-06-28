#!/usr/bin/env python3
"""
从 Excel 导出的 CSV 文件迁移到 asset-snapshot 的 SQLite 数据库。

使用方法：
1. 在 Excel 中将表格另存为 CSV（UTF-8编码，第一列是yyyy/mm/dd日期，其余列按「平台.账户」格式）
2. 修改下方 INPUT_CSV_PATH 为你的 CSV 文件路径
3. 运行: python3 import_csv.py
4. 生成的 imported.asdb 在同目录，可在软件中打开
"""

import csv
import sqlite3
import os
import re
from datetime import datetime

# ============================================================
# 在这里修改输入文件路径
# ============================================================
INPUT_CSV_PATH = "path/to/your/data.csv"

# ============================================================
# 输出文件（和脚本同目录）
# ============================================================
OUTPUT_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "imported.asdb")


def create_schema(conn):
    """创建和 asset-snapshot 一致的表结构"""
    conn.executescript("""
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS platforms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform_id INTEGER NOT NULL REFERENCES platforms(id),
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('asset_liquid', 'asset_nonliquid', 'debt')),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            snapshot_time TEXT DEFAULT '00:00',
            note TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS snapshot_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            amount TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(snapshot_id, account_id)
        );

        CREATE INDEX IF NOT EXISTS idx_accounts_platform_id ON accounts(platform_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
        CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot_id ON snapshot_items(snapshot_id);
    """)


def parse_date(raw: str) -> str:
    """将 yyyy/mm/dd 或 yyyy-mm-dd 统一转为 yyyy-mm-dd"""
    raw = raw.strip()
    for fmt in ("%Y/%m/%d", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {raw}")


def parse_account_amount(raw: str) -> str:
    """解析金额，空值按 0 处理"""
    raw = raw.strip()
    if raw == "":
        return "0.00"
    # 去掉可能的千分位逗号
    raw = raw.replace(",", "")
    # 确保两位小数
    amount = float(raw)
    return f"{amount:.2f}"


def parse_columns(header_row: list[str]) -> list[tuple[str, str, int]]:
    """
    解析表头，返回 [(平台名, 账户名, 列索引), ...]
    第一列是日期，跳过；其余列按「平台.账户」格式解析
    """
    result = []
    for idx, col in enumerate(header_row):
        col = col.strip()
        if idx == 0 or not col:
            continue
        if "." in col:
            platform, account = col.split(".", 1)
            platform = platform.strip()
            account = account.strip()
            if platform and account:
                result.append((platform, account, idx))
        else:
            # 没有点号时当独立账户名，平台用列名本身
            if col:
                result.append((col, col, idx))
    return result


def import_csv():
    if not os.path.exists(INPUT_CSV_PATH):
        print(f"错误: 找不到文件 {INPUT_CSV_PATH}")
        print("请修改脚本中的 INPUT_CSV_PATH 后再运行")
        return

    # 删除旧输出文件
    if os.path.exists(OUTPUT_DB):
        os.remove(OUTPUT_DB)

    conn = sqlite3.connect(OUTPUT_DB)
    create_schema(conn)

    with open(INPUT_CSV_PATH, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if len(rows) < 2:
        print("错误: CSV 至少需要表头行和一行数据")
        conn.close()
        return

    header = rows[0]
    columns = parse_columns(header)
    if not columns:
        print("错误: 未找到有效的「平台.账户」列")
        conn.close()
        return

    # 收集所有平台和账户，保持 CSV 中的出现顺序
    platforms: dict[str, int] = {}  # name -> sort_order
    accounts: dict[tuple[str, str], int] = {}  # (platform, account) -> account_id

    for platform_name, account_name, _ in columns:
        if platform_name not in platforms:
            platforms[platform_name] = len(platforms)

    # 插入平台
    for name, sort_order in platforms.items():
        conn.execute(
            "INSERT INTO platforms (name, sort_order) VALUES (?, ?)",
            (name, sort_order),
        )

    # 为每个 (平台, 账户) 组合插入账户
    for platform_name, account_name, _ in columns:
        platform_row = conn.execute(
            "SELECT id FROM platforms WHERE name = ?", (platform_name,)
        ).fetchone()
        if not platform_row:
            continue
        platform_id = platform_row[0]

        cursor = conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (?, ?, 'asset_liquid', 0)",
            (platform_id, account_name),
        )
        accounts[(platform_name, account_name)] = cursor.lastrowid

    # 处理数据行
    imported_count = 0
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue  # 跳过空行

        try:
            date_str = parse_date(row[0])
        except ValueError as e:
            print(f"跳过行（日期解析失败）: {row[0]} — {e}")
            continue

        # 收集本行的 snapshot items
        items = []
        for platform_name, account_name, col_idx in columns:
            if col_idx >= len(row):
                continue
            raw_amount = row[col_idx]
            amount = parse_account_amount(raw_amount)
            account_id = accounts.get((platform_name, account_name))
            if account_id is not None:
                items.append((account_id, amount))

        if not items:
            continue

        # 插入 snapshot + items
        cursor = conn.execute(
            "INSERT INTO snapshots (date) VALUES (?)", (date_str,)
        )
        snapshot_id = cursor.lastrowid

        for account_id, amount in items:
            conn.execute(
                "INSERT OR IGNORE INTO snapshot_items (snapshot_id, account_id, amount) VALUES (?, ?, ?)",
                (snapshot_id, account_id, amount),
            )

        imported_count += 1

    conn.commit()

    # 统计
    platform_count = len(platforms)
    account_count = len(accounts)

    conn.close()

    print(f"导入完成: {imported_count} 条快照, {platform_count} 个平台, {account_count} 个账户")
    print(f"输出文件: {OUTPUT_DB}")
    print("提示: 所有账户默认为「流动资产」，后续可在软件中按需修改类型。")


if __name__ == "__main__":
    import_csv()

