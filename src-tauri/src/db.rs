use crate::calculations::calculate_snapshot;
use crate::models::{
    Account, AccountType, AnalysisItem, AnalysisItemType, AppError, CreateAccountInput,
    CreatePlatformInput, CreateSnapshotInput, DashboardData, DeleteAccountInput,
    DeletePlatformInput, DeleteSnapshotInput, GetSnapshotAnalysisInput, MoveAccountInput,
    MoveDirection, MovePlatformInput, Platform, Snapshot, SnapshotAnalysis, SnapshotItem,
    SnapshotItemForCalc, SnapshotSummary, UpdateAccountActiveInput, UpdateAccountInput,
    UpdatePlatformInput, UpdateSnapshotInput,
};
use anyhow::{Context, Result};
use chrono::NaiveDate;
use directories::ProjectDirs;
use rusqlite::{params, Connection, Transaction};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub struct AppDatabase {
    conn: Connection,
    path: PathBuf,
    encrypted: bool,
}

impl AppDatabase {
    #[allow(dead_code)]
    pub fn open_default() -> Result<Self> {
        let path = configured_database_path()?.unwrap_or(default_database_path()?);
        let encrypted = configured_database_encrypted()?;
        if encrypted {
            return Err(anyhow::anyhow!("encrypted database requires password"));
        }
        Self::open_path(path, None)
    }

    pub fn open_path(path: PathBuf, password: Option<&str>) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).context("failed to create application data directory")?;
        }

        let file_already_existed = path.exists();

        let conn = Connection::open(&path).context("failed to open sqlite database")?;

        if let Some(pwd) = password {
            conn.execute_batch(&pragma_key_sql(pwd))
                .context("failed to set database key")?;
            conn.execute_batch("PRAGMA cipher_compatibility = 4;")
                .context("failed to set cipher compatibility")?;
        }

        // Verify database is readable by checking sqlite_master.
        // For encrypted databases opened without a key, this will fail.
        let verify_result = conn.query_row(
            "SELECT count(*) FROM sqlite_master",
            [],
            |row| row.get::<_, i64>(0),
        );

        match verify_result {
            Ok(_) => {}
            Err(rusqlite::Error::SqliteFailure(err, _))
                if err.code == rusqlite::ErrorCode::NotADatabase =>
            {
                if password.is_some() {
                    return Err(anyhow::anyhow!("authentication failed"));
                }
                return Err(anyhow::anyhow!("authentication required"));
            }
            Err(e) => {
                if !file_already_existed && password.is_none() {
                    // File didn't exist before open — it was just created.
                    // This is a blank new file; proceed with migration.
                } else {
                    return Err(e.into());
                }
            }
        }

        let encrypted = password.is_some();
        let db = Self { conn, path, encrypted };
        db.migrate()?;
        db.seed_if_empty()?;
        Ok(db)
    }

    pub fn current_path(&self) -> &Path {
        &self.path
    }

    pub fn is_encrypted(&self) -> bool {
        self.encrypted
    }

    pub fn set_password(&mut self, password: &str) -> Result<(), AppError> {
        if password.len() < crate::models::MIN_PASSWORD_LENGTH {
            return Err(AppError::InvalidPassword(
                crate::models::MIN_PASSWORD_LENGTH,
            ));
        }
        if self.encrypted {
            return Err(AppError::Validation("数据库已加密，请使用修改密码功能".into()));
        }

        // Use sqlcipher_export to create an encrypted copy of the plaintext database.
        // PRAGMA rekey only works on already-encrypted databases; for first-time
        // encryption we must export to a new file and then replace the original.
        let esc_pwd = escape_sql_password(password);
        let tmp_path = self
            .path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(".asset-snapshot-encrypting-tmp");

        // Remove stale tmp file if it exists
        let _ = std::fs::remove_file(&tmp_path);

        self.conn
            .execute_batch("PRAGMA cipher_compatibility = 4;")
            .map_err(|e| AppError::Database(e.to_string()))?;
        self.conn
            .execute_batch(&format!(
                "ATTACH DATABASE '{}' AS encrypted KEY '{}';",
                tmp_path.to_string_lossy().replace('\'', "''"),
                esc_pwd
            ))
            .map_err(|e| AppError::Database(e.to_string()))?;
        self.conn
            .execute_batch("SELECT sqlcipher_export('encrypted');")
            .map_err(|e| AppError::Database(e.to_string()))?;
        self.conn
            .execute_batch("DETACH DATABASE encrypted;")
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Rename the encrypted tmp file over the original.
        // On Linux the old inode stays alive until the last fd is closed,
        // so the current connection (pointing to the old inode) remains valid.
        std::fs::rename(&tmp_path, &self.path).map_err(|e| {
            // Clean up tmp file on failure
            let _ = std::fs::remove_file(&tmp_path);
            AppError::Database(format!("无法替换数据库文件: {e}"))
        })?;

        // Close the old plaintext connection and open the new encrypted file
        self.conn = Connection::open(&self.path)
            .map_err(|e| AppError::Database(format!("无法重新打开数据库: {e}")))?;
        self.conn
            .execute_batch(&pragma_key_sql(password))
            .map_err(|e| AppError::Database(e.to_string()))?;
        self.conn
            .execute_batch("PRAGMA cipher_compatibility = 4;")
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Verify the file is encrypted by checking its header.
        // A SQLCipher-encrypted file must NOT start with the plaintext SQLite magic.
        match std::fs::read(&self.path) {
            Ok(header) if header.len() >= 16 && &header[0..16] == b"SQLite format 3\0" => {
                let _ = std::fs::remove_file(&tmp_path);
                return Err(AppError::Database(
                    "数据库加密未生效：文件头仍为明文 SQLite 格式。请确认 SQLCipher 已正确编译。".into(),
                ));
            }
            Err(e) => {
                let _ = std::fs::remove_file(&tmp_path);
                return Err(AppError::Database(format!("无法读取数据库文件以验证加密: {e}")));
            }
            _ => {} // Header is not plaintext — encryption succeeded
        }

        // Verify the database is readable with the new key
        self.conn
            .query_row(
                "SELECT count(*) FROM sqlite_master",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| {
                AppError::Database(format!("加密后数据库验证失败: {e}"))
            })?;

        self.encrypted = true;
        self.remember_current_path()?;
        Ok(())
    }

    pub fn change_password(&self, new_password: &str) -> Result<(), AppError> {
        if new_password.len() < crate::models::MIN_PASSWORD_LENGTH {
            return Err(AppError::InvalidPassword(
                crate::models::MIN_PASSWORD_LENGTH,
            ));
        }
        if !self.encrypted {
            return Err(AppError::Validation("数据库未加密".into()));
        }
        self.conn
            .execute_batch(&format!(
                "PRAGMA rekey = '{}'",
                escape_sql_password(new_password)
            ))
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn remove_password(&mut self) -> Result<(), AppError> {
        if !self.encrypted {
            return Err(AppError::Validation("数据库未加密".into()));
        }
        self.conn
            .execute_batch("PRAGMA rekey = ''")
            .map_err(|e| AppError::Database(e.to_string()))?;
        self.encrypted = false;
        self.remember_current_path()?;
        Ok(())
    }

    pub fn remember_current_path(&self) -> Result<(), AppError> {
        let path = app_config_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create config directory {}", parent.display())
            })?;
        }
        let config = DataFileConfig {
            current_path: self.path.to_string_lossy().into_owned(),
            encrypted: self.encrypted,
        };
        let content = serde_json::to_string_pretty(&config)
            .context("failed to serialize data file config")?;
        fs::write(&path, content)
            .with_context(|| format!("failed to write data file config {}", path.display()))?;
        Ok(())
    }

    pub fn backup_to(&self, target_path: &Path) -> Result<(), AppError> {
        if target_path == self.path {
            return Err(AppError::Validation(
                "备份路径不能与当前数据文件相同".into(),
            ));
        }
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create backup directory {}", parent.display())
            })?;
        }
        self.conn
            .execute_batch("PRAGMA wal_checkpoint(FULL);")
            .context("failed to checkpoint sqlite database before backup")?;
        fs::copy(&self.path, target_path)
            .with_context(|| format!("failed to copy backup to {}", target_path.display()))?;
        Ok(())
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
            params![
                date,
                normalized_note(input.note.as_deref()),
                input.snapshot_id
            ],
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

    pub fn update_platform(&self, input: UpdatePlatformInput) -> Result<(), AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("平台名称不能为空".into()));
        }

        let changed = self.conn.execute(
            "UPDATE platforms SET name = ?1 WHERE id = ?2",
            params![name, input.platform_id],
        )?;
        if changed == 0 {
            return Err(AppError::Validation("平台不存在".into()));
        }
        Ok(())
    }

    pub fn move_platform(&mut self, input: MovePlatformInput) -> Result<(), AppError> {
        let platforms = self.platforms()?;
        let Some(index) = platforms
            .iter()
            .position(|platform| platform.id == input.platform_id)
        else {
            return Err(AppError::Validation("平台不存在".into()));
        };
        let target_index = match input.direction {
            MoveDirection::Up if index > 0 => index - 1,
            MoveDirection::Down if index + 1 < platforms.len() => index + 1,
            _ => return Ok(()),
        };

        let current = &platforms[index];
        let target = &platforms[target_index];
        let transaction = self.conn.transaction()?;
        transaction.execute(
            "UPDATE platforms SET sort_order = ?1 WHERE id = ?2",
            params![target.sort_order, current.id],
        )?;
        transaction.execute(
            "UPDATE platforms SET sort_order = ?1 WHERE id = ?2",
            params![current.sort_order, target.id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn update_account(&self, input: UpdateAccountInput) -> Result<(), AppError> {
        let name = input.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("账户名称不能为空".into()));
        }

        let changed = self.conn.execute(
            "UPDATE accounts SET name = ?1 WHERE id = ?2",
            params![name, input.account_id],
        )?;
        if changed == 0 {
            return Err(AppError::Validation("账户不存在".into()));
        }
        Ok(())
    }

    pub fn move_account(&mut self, input: MoveAccountInput) -> Result<(), AppError> {
        let account = self.conn.query_row(
            "SELECT platform_id FROM accounts WHERE id = ?1",
            params![input.account_id],
            |row| row.get::<_, i64>(0),
        );
        let platform_id = match account {
            Ok(platform_id) => platform_id,
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                return Err(AppError::Validation("账户不存在".into()))
            }
            Err(error) => return Err(error.into()),
        };

        let accounts = self.accounts_for_platform(platform_id)?;
        let Some(index) = accounts
            .iter()
            .position(|account| account.id == input.account_id)
        else {
            return Err(AppError::Validation("账户不存在".into()));
        };
        let target_index = match input.direction {
            MoveDirection::Up if index > 0 => index - 1,
            MoveDirection::Down if index + 1 < accounts.len() => index + 1,
            _ => return Ok(()),
        };

        let current = &accounts[index];
        let target = &accounts[target_index];
        let transaction = self.conn.transaction()?;
        transaction.execute(
            "UPDATE accounts SET sort_order = ?1 WHERE id = ?2",
            params![target.sort_order, current.id],
        )?;
        transaction.execute(
            "UPDATE accounts SET sort_order = ?1 WHERE id = ?2",
            params![current.sort_order, target.id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn delete_account(&self, input: DeleteAccountInput) -> Result<(), AppError> {
        let history_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM snapshot_items WHERE account_id = ?1",
            params![input.account_id],
            |row| row.get(0),
        )?;
        if history_count > 0 {
            return Err(AppError::Validation(
                "账户已有历史快照，不能删除；可以停用账户".into(),
            ));
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

    pub fn snapshot_analysis(
        &self,
        input: GetSnapshotAnalysisInput,
    ) -> Result<SnapshotAnalysis, AppError> {
        self.ensure_snapshot_exists(input.snapshot_id)?;

        let analysis_id = self.analysis_id_for_snapshot(input.snapshot_id)?;
        let Some(analysis_id) = analysis_id else {
            return Ok(SnapshotAnalysis {
                snapshot_id: input.snapshot_id,
                items: Vec::new(),
            });
        };

        let mut stmt = self.conn.prepare(
            r#"
            SELECT id, type, name
            FROM analysis_items
            WHERE analysis_id = ?1
            ORDER BY sort_order, id
            "#,
        )?;
        let item_rows = stmt.query_map(params![analysis_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })?;
        let item_rows = item_rows.collect::<rusqlite::Result<Vec<_>>>()?;

        let items = item_rows
            .into_iter()
            .map(|(item_id, item_type, name)| {
                Ok(AnalysisItem {
                    item_type: AnalysisItemType::from_db(&item_type),
                    name,
                    amounts: self.analysis_amounts(item_id)?,
                })
            })
            .collect::<Result<Vec<_>>>()?;

        Ok(SnapshotAnalysis {
            snapshot_id: input.snapshot_id,
            items,
        })
    }

    pub fn save_snapshot_analysis(
        &mut self,
        input: SnapshotAnalysis,
    ) -> Result<SnapshotAnalysis, AppError> {
        self.ensure_snapshot_exists(input.snapshot_id)?;
        validate_analysis_items(&input.items)?;

        let transaction = self.conn.transaction()?;
        transaction.execute(
            "INSERT INTO snapshot_analysis (snapshot_id) VALUES (?1)
             ON CONFLICT(snapshot_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
            params![input.snapshot_id],
        )?;
        let analysis_id: i64 = transaction.query_row(
            "SELECT id FROM snapshot_analysis WHERE snapshot_id = ?1",
            params![input.snapshot_id],
            |row| row.get(0),
        )?;

        transaction.execute(
            "DELETE FROM analysis_items WHERE analysis_id = ?1",
            params![analysis_id],
        )?;

        for (item_index, item) in input.items.iter().enumerate() {
            transaction.execute(
                "INSERT INTO analysis_items (analysis_id, type, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![
                    analysis_id,
                    item.item_type.as_db(),
                    item.name.trim(),
                    item_index as i64 + 1,
                ],
            )?;
            let item_id = transaction.last_insert_rowid();
            for amount in &item.amounts {
                transaction.execute(
                    "INSERT INTO analysis_amounts (analysis_item_id, amount) VALUES (?1, ?2)",
                    params![item_id, amount.trim()],
                )?;
            }
        }

        transaction.commit()?;
        Ok(input)
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

            CREATE TABLE IF NOT EXISTS snapshot_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(snapshot_id)
            );

            CREATE TABLE IF NOT EXISTS analysis_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER NOT NULL REFERENCES snapshot_analysis(id) ON DELETE CASCADE,
                type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS analysis_amounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_item_id INTEGER NOT NULL REFERENCES analysis_items(id) ON DELETE CASCADE,
                amount TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_accounts_platform_id ON accounts(platform_id);
            CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
            CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot_id ON snapshot_items(snapshot_id);
            CREATE INDEX IF NOT EXISTS idx_analysis_items_analysis_id ON analysis_items(analysis_id);
            CREATE INDEX IF NOT EXISTS idx_analysis_amounts_item_id ON analysis_amounts(analysis_item_id);
            "#,
        )?;
        Ok(())
    }

    fn seed_if_empty(&self) -> Result<()> {
        let count: i64 = self
            .conn
            .query_row("SELECT COUNT(*) FROM platforms", [], |row| row.get(0))?;
        if count > 0 {
            return Ok(());
        }

        self.conn.execute(
            "INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)",
            params!["支付宝", 1],
        )?;
        self.conn.execute(
            "INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)",
            params!["招商银行", 2],
        )?;
        self.conn.execute(
            "INSERT INTO platforms (name, sort_order) VALUES (?1, ?2)",
            params!["微信", 3],
        )?;

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
            (
                "2026-01-31",
                ["7200.00", "16800.00", "2600.00", "43100.00", "4400.00"],
            ),
            (
                "2026-02-28",
                ["8200.00", "17600.00", "3200.00", "44750.00", "5100.00"],
            ),
            (
                "2026-03-31",
                ["9400.00", "18100.00", "3400.00", "46230.00", "5550.00"],
            ),
        ] {
            self.conn.execute(
                "INSERT INTO snapshots (date, note) VALUES (?1, ?2)",
                params![date, "初始化示例"],
            )?;
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
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn accounts(&self) -> Result<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            r#"
            SELECT a.id, a.platform_id, a.name, a.type, a.sort_order, a.is_active
            FROM accounts a
            JOIN platforms p ON p.id = a.platform_id
            ORDER BY p.sort_order, p.id, a.sort_order, a.id
            "#,
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
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn accounts_for_platform(&self, platform_id: i64) -> Result<Vec<Account>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, platform_id, name, type, sort_order, is_active FROM accounts WHERE platform_id = ?1 ORDER BY sort_order, id",
        )?;
        let rows = stmt.query_map(params![platform_id], |row| {
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
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn snapshot_summaries(&self) -> Result<Vec<SnapshotSummary>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, date FROM snapshots ORDER BY date ASC, id ASC")?;
        let snapshot_rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
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
        let mut stmt = self
            .conn
            .prepare("SELECT id, date, note FROM snapshots ORDER BY date ASC, id ASC")?;
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
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
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
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
    }

    fn ensure_snapshot_exists(&self, snapshot_id: i64) -> Result<(), AppError> {
        let snapshot_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM snapshots WHERE id = ?1",
            params![snapshot_id],
            |row| row.get(0),
        )?;
        if snapshot_count == 0 {
            return Err(AppError::Validation("快照不存在".into()));
        }
        Ok(())
    }

    fn analysis_id_for_snapshot(&self, snapshot_id: i64) -> Result<Option<i64>> {
        let result = self.conn.query_row(
            "SELECT id FROM snapshot_analysis WHERE snapshot_id = ?1",
            params![snapshot_id],
            |row| row.get(0),
        );
        match result {
            Ok(id) => Ok(Some(id)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    fn analysis_amounts(&self, item_id: i64) -> Result<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT amount FROM analysis_amounts WHERE analysis_item_id = ?1 ORDER BY id",
        )?;
        let rows = stmt.query_map(params![item_id], |row| row.get(0))?;
        rows.collect::<rusqlite::Result<Vec<_>>>()
            .map_err(Into::into)
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

fn validate_analysis_items(items: &[AnalysisItem]) -> Result<(), AppError> {
    for item in items {
        if item.name.trim().is_empty() {
            return Err(AppError::Validation("分析项目名称不能为空".into()));
        }
        if item.amounts.is_empty() {
            return Err(AppError::Validation("分析项目至少需要一条金额".into()));
        }
        for amount in &item.amounts {
            Decimal::from_str_exact(amount.trim())
                .map_err(|_| AppError::Validation("分析金额格式不正确".into()))?;
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn default_database_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("asset-snapshot.db"))
}

#[allow(dead_code)]
fn configured_database_path() -> Result<Option<PathBuf>> {
    let config = read_config_file()?;
    let Some(config) = config else {
        return Ok(None);
    };
    let current_path = config.current_path.trim();
    if current_path.is_empty() {
        return Ok(None);
    }
    Ok(Some(PathBuf::from(current_path)))
}

fn configured_database_encrypted() -> Result<bool> {
    let config = read_config_file()?;
    Ok(config.map(|c| c.encrypted).unwrap_or(false))
}

pub fn read_config_encrypted() -> Result<bool> {
    configured_database_encrypted()
}

fn read_config_file() -> Result<Option<DataFileConfig>> {
    let path = app_config_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let Ok(content) = fs::read_to_string(&path) else {
        return Ok(None);
    };
    let Ok(config) = serde_json::from_str::<DataFileConfig>(&content) else {
        return Ok(None);
    };
    Ok(Some(config))
}

fn app_config_path() -> Result<PathBuf> {
    Ok(app_data_dir()?.join("data-file.json"))
}

fn app_data_dir() -> Result<PathBuf> {
    let dirs = ProjectDirs::from("com", "asset-snapshot", "asset-snapshot")
        .context("failed to resolve application data directory")?;
    Ok(dirs.data_local_dir().to_path_buf())
}

#[derive(Debug, Deserialize, Serialize)]
struct DataFileConfig {
    current_path: String,
    #[serde(default)]
    encrypted: bool,
}

fn escape_sql_password(password: &str) -> String {
    password.replace('\'', "''")
}

fn pragma_key_sql(password: &str) -> String {
    format!("PRAGMA key = '{}'", escape_sql_password(password))
}
