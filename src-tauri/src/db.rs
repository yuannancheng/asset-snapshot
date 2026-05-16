use crate::calculations::calculate_snapshot;
use crate::models::{
    Account, AccountType, AppError, CreateAccountInput, CreatePlatformInput, CreateSnapshotInput,
    DashboardData, DeleteAccountInput, DeletePlatformInput, DeleteSnapshotInput, Platform, Snapshot,
    SnapshotItem, SnapshotItemForCalc, SnapshotSummary, UpdateAccountActiveInput, UpdateSnapshotInput,
};
use anyhow::{Context, Result};
use chrono::NaiveDate;
use directories::ProjectDirs;
use rusqlite::{params, Connection, Transaction};
use rust_decimal::Decimal;
use std::fs;
use std::path::PathBuf;

pub struct AppDatabase {
    conn: Connection,
}

impl AppDatabase {
    pub fn open_default() -> Result<Self> {
        let path = default_database_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("failed to create application data directory")?;
        }

        let conn = Connection::open(path).context("failed to open sqlite database")?;
        let db = Self { conn };
        db.migrate()?;
        db.seed_if_empty()?;
        Ok(db)
    }

    pub fn dashboard_data(&self) -> Result<DashboardData, AppError> {
        Ok(DashboardData {
            platforms: self.platforms()?,
            accounts: self.accounts()?,
            snapshots: self.snapshots()?,
            summaries: self.snapshot_summaries()?,
        })
    }

    pub fn create_platform(&self, input: CreatePlatformInput) -> Result<(), AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("平台名称不能为空".into()));
        }

        let sort_order: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM platforms",
            [],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)",
            params![name, sort_order],
        )?;
        Ok(())
    }

    pub fn create_account(&self, input: CreateAccountInput) -> Result<(), AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("账户名称不能为空".into()));
        }

        let platform_exists: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM platforms WHERE id = ?1",
            params![input.platform_id],
            |row| row.get(0),
        )?;
        if platform_exists == 0 {
            return Err(AppError::Validation("平台不存在".into()));
        }

        let sort_order: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM accounts WHERE platform_id = ?1",
            params![input.platform_id],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![
                input.platform_id,
                name,
                input.account_type.as_db(),
                sort_order
            ],
        )?;
        Ok(())
    }

    pub fn create_snapshot(&mut self, input: CreateSnapshotInput) -> Result<(), AppError> {
        let date = validate_snapshot_date(&input.date)?;
        validate_snapshot_items(&input.items)?;

        let transaction = self.conn.transaction()?;
        transaction.execute(
            "INSERT INTO snapshots (date, note) VALUES (?1, ?2)",
            params![date, normalized_note(input.note.as_deref())],
        )?;
        let snapshot_id = transaction.last_insert_rowid();

        insert_snapshot_items(&transaction, snapshot_id, &input.items)?;

        transaction.commit()?;
        Ok(())
    }

    pub fn update_snapshot(&mut self, input: UpdateSnapshotInput) -> Result<(), AppError> {
        let date = validate_snapshot_date(&input.date)?;
        validate_snapshot_items(&input.items)?;

        let transaction = self.conn.transaction()?;
        let changed = transaction.execute(
            "UPDATE snapshots SET date = ?1, note = ?2 WHERE id = ?3",
            params![date, normalized_note(input.note.as_deref()), input.snapshot_id],
        )?;
        if changed == 0 {
            return Err(AppError::Validation("快照不存在".into()));
        }

        transaction.execute(
            "DELETE FROM snapshot_items WHERE snapshot_id = ?1",
            params![input.snapshot_id],
        )?;
        insert_snapshot_items(&transaction, input.snapshot_id, &input.items)?;

        transaction.commit()?;
        Ok(())
    }

    pub fn delete_snapshot(&self, input: DeleteSnapshotInput) -> Result<(), AppError> {
        let changed = self.conn.execute(
            "DELETE FROM snapshots WHERE id = ?1",
            params![input.snapshot_id],
        )?;
        if changed == 0 {
            return Err(AppError::Validation("快照不存在".into()));
        }
        Ok(())
    }

    pub fn update_account_active(&self, input: UpdateAccountActiveInput) -> Result<(), AppError> {
        let changed = self.conn.execute(
            "UPDATE accounts SET is_active = ?1 WHERE id = ?2",
            params![if input.is_active { 1 } else { 0 }, input.account_id],
        )?;
        if changed == 0 {
            return Err(AppError::Validation("账户不存在".into()));
        }
        Ok(())
    }

    pub fn delete_account(&self, input: DeleteAccountInput) -> Result<(), AppError> {
        let history_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM snapshot_items WHERE account_id = ?1",
            params![input.account_id],
            |row| row.get(0),
        )?;
        if history_count > 0 {
            return Err(AppError::Validation("账户已有历史快照，不能删除；可以停用账户".into()));
        }

        let changed = self.conn.execute(
            "DELETE FROM accounts WHERE id = ?1",
            params![input.account_id],
        )?;
        if changed == 0 {
            return Err(AppError::Validation("账户不存在".into()));
        }
        Ok(())
    }

    pub fn delete_platform(&mut self, input: DeletePlatformInput) -> Result<(), AppError> {
        let platform_exists: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM platforms WHERE id = ?1",
            params![input.platform_id],
            |row| row.get(0),
        )?;
        if platform_exists == 0 {
            return Err(AppError::Validation("平台不存在".into()));
        }

        let history_count: i64 = self.conn.query_row(
            r#"
            SELECT COUNT(*)
            FROM snapshot_items si
            JOIN accounts a ON a.id = si.account_id
            WHERE a.platform_id = ?1
            "#,
            params![input.platform_id],
            |row| row.get(0),
        )?;
        if history_count > 0 {
            return Err(AppError::Validation("平台下已有历史快照，不能删除".into()));
        }

        let transaction = self.conn.transaction()?;
        transaction.execute(
            "DELETE FROM accounts WHERE platform_id = ?1",
            params![input.platform_id],
        )?;
        transaction.execute(
            "DELETE FROM platforms WHERE id = ?1",
            params![input.platform_id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS platforms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
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
            "#,
        )?;
        Ok(())
    }

    fn seed_if_empty(&self) -> Result<()> {
        let count: i64 = self.conn.query_row("SELECT COUNT(*) FROM platforms", [], |row| row.get(0))?;
        if count > 0 {
            return Ok(());
        }

        self.conn.execute("INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)", params!["支付宝", 1])?;
        self.conn.execute("INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)", params!["招商银行", 2])?;
        self.conn.execute("INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)", params!["微信", 3])?;

        self.conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (1, '余额', 'asset_liquid', 1)",
            [],
        )?;
        self.conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (1, '理财', 'asset_nonliquid', 2)",
            [],
        )?;
        self.conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (1, '花呗', 'debt', 3)",
            [],
        )?;
        self.conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (2, '储蓄卡', 'asset_liquid', 1)",
            [],
        )?;
        self.conn.execute(
            "INSERT INTO accounts (platform_id, name, type, sort_order) VALUES (3, '零钱', 'asset_liquid', 1)",
            [],
        )?;

        for (date, values) in [
            ("2026-01-31", ["7200.00", "16800.00", "2600.00", "43100.00", "4400.00"]),
            ("2026-02-28", ["8200.00", "17600.00", "3200.00", "44750.00", "5100.00"]),
            ("2026-03-31", ["9400.00", "18100.00", "3400.00", "46230.00", "5550.00"]),
        ] {
            self.conn.execute("INSERT INTO snapshots (date, note) VALUES (?1, ?2)", params![date, "初始化示例"])?;
            let snapshot_id = self.conn.last_insert_rowid();
            for (account_index, amount) in values.iter().enumerate() {
                self.conn.execute(
                    "INSERT INTO snapshot_items (snapshot_id, account_id, amount) VALUES (?1, ?2, ?3)",
                    params![snapshot_id, (account_index + 1) as i64, amount],
                )?;
            }
        }

        Ok(())
    }

    fn platforms(&self) -> Result<Vec<Platform>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, sort_order FROM platforms ORDER BY sort_order, id")?;
        let rows = stmt.query_map([], |row| {
            Ok(Platform {
                id: row.get(0)?,
                name: row.get(1)?,
                sort_order: row.get(2)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }

    fn accounts(&self) -> Result<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, platform_id, name, type, sort_order, is_active FROM accounts ORDER BY platform_id, sort_order, id",
        )?;
        let rows = stmt.query_map([], |row| {
            let account_type: String = row.get(3)?;
            let is_active: i64 = row.get(5)?;
            Ok(Account {
                id: row.get(0)?,
                platform_id: row.get(1)?,
                name: row.get(2)?,
                account_type: AccountType::from_db(&account_type),
                sort_order: row.get(4)?,
                is_active: is_active == 1,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }

    fn snapshot_summaries(&self) -> Result<Vec<SnapshotSummary>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, date FROM snapshots ORDER BY date ASC, id ASC")?;
        let snapshot_rows = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?;
        let snapshots = snapshot_rows.collect::<rusqlite::Result<Vec<_>>>()?;

        snapshots
            .into_iter()
            .map(|(snapshot_id, date)| {
                let items = self.snapshot_items_for_calc(snapshot_id)?;
                let calculated = calculate_snapshot(&items);
                Ok(SnapshotSummary {
                    snapshot_id,
                    date,
                    total_asset: calculated.total_asset,
                    available_asset: calculated.available_asset,
                    platform_assets: calculated.platform_assets,
                })
            })
            .collect()
    }

    fn snapshots(&self) -> Result<Vec<Snapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, date, note FROM snapshots ORDER BY date ASC, id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })?;
        let snapshots = rows.collect::<rusqlite::Result<Vec<_>>>()?;

        snapshots
            .into_iter()
            .map(|(id, date, note)| {
                Ok(Snapshot {
                    id,
                    date,
                    note,
                    items: self.snapshot_items(id)?,
                })
            })
            .collect()
    }

    fn snapshot_items(&self, snapshot_id: i64) -> Result<Vec<SnapshotItem>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT si.account_id, si.amount
            FROM snapshot_items si
            JOIN accounts a ON a.id = si.account_id
            JOIN platforms p ON p.id = a.platform_id
            WHERE si.snapshot_id = ?1
            ORDER BY p.sort_order, a.sort_order, a.id
            "#,
        )?;
        let rows = stmt.query_map(params![snapshot_id], |row| {
            Ok(SnapshotItem {
                account_id: row.get(0)?,
                amount: row.get(1)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }

    fn snapshot_items_for_calc(&self, snapshot_id: i64) -> Result<Vec<SnapshotItemForCalc>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT p.id, p.name, a.type, si.amount
            FROM snapshot_items si
            JOIN accounts a ON a.id = si.account_id
            JOIN platforms p ON p.id = a.platform_id
            WHERE si.snapshot_id = ?1
            ORDER BY p.sort_order, a.sort_order, a.id
            "#,
        )?;
        let rows = stmt.query_map(params![snapshot_id], |row| {
            let account_type: String = row.get(2)?;
            Ok(SnapshotItemForCalc {
                platform_id: row.get(0)?,
                platform_name: row.get(1)?,
                account_type: AccountType::from_db(&account_type),
                amount: row.get(3)?,
            })
        })?;
        rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Into::into)
    }
}

fn validate_snapshot_date(value: &str) -> Result<&str, AppError> {
    let date = value.trim();
    if date.is_empty() {
        return Err(AppError::Validation("快照日期不能为空".into()));
    }
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("日期格式应为 YYYY-MM-DD".into()))?;
    Ok(date)
}

fn validate_snapshot_items(
    items: &[crate::models::CreateSnapshotItemInput],
) -> Result<(), AppError> {
    if items.is_empty() {
        return Err(AppError::Validation("快照至少需要一个账户金额".into()));
    }
    for item in items {
        Decimal::from_str_exact(item.amount.trim())
            .map_err(|_| AppError::Validation("金额格式不正确".into()))?;
    }
    Ok(())
}

fn normalized_note(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

fn insert_snapshot_items(
    transaction: &Transaction<'_>,
    snapshot_id: i64,
    items: &[crate::models::CreateSnapshotItemInput],
) -> Result<(), AppError> {
    for item in items {
        transaction.execute(
            "INSERT INTO snapshot_items (snapshot_id, account_id, amount) VALUES (?1, ?2, ?3)",
            params![snapshot_id, item.account_id, item.amount.trim()],
        )?;
    }
    Ok(())
}

fn default_database_path() -> Result<PathBuf> {
    let dirs = ProjectDirs::from("com", "asset-snapshot", "asset-snapshot")
        .context("failed to resolve application data directory")?;
    Ok(dirs.data_local_dir().join("asset-snapshot.db"))
}
