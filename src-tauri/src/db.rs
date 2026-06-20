use crate::calculations::calculate_snapshot;
use crate::models::{
    Account, AccountType, AnalysisItem, AnalysisItemType, AppError, CreateAccountInput,
    CreatePlatformInput, CreateSnapshotInput, DashboardData, DeleteAccountInput,
    DeletePlatformInput, DeleteSnapshotInput, GetSnapshotAnalysisInput, MoveAccountInput,
    MoveDirection, MovePlatformInput, Platform, Snapshot, SnapshotAnalysis, SnapshotItem,
    SnapshotItemForCalc, SnapshotSummary, GetSnapshotsPageInput, PaginatedSnapshots, UpdateAccountActiveInput, UpdateAccountInput,
    UpdatePlatformInput, UpdateSnapshotInput, UpdateAccountTypeInput,
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

        conn.execute_batch("PRAGMA cipher_compatibility = 4;")
            .context("failed to set cipher compatibility")?;

        if let Some(pwd) = password {
            conn.execute_batch(&pragma_key_sql(pwd))
                .context("failed to set database key")?;
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

        // Ensure any leftover attachment from a previous failed attempt is cleaned up
        let _ = self.conn.execute_batch("DETACH DATABASE encrypted;");

        self.conn
            .execute_batch(&format!(
                "ATTACH DATABASE '{}' AS encrypted KEY '{}';",
                tmp_path.to_string_lossy().replace('\'', "''"),
                esc_pwd
            ))
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Perform export and always detach, even on error
        let export_result = self
            .conn
            .execute_batch("SELECT sqlcipher_export('encrypted');")
            .map_err(|e| AppError::Database(e.to_string()));
        let _ = self.conn.execute_batch("DETACH DATABASE encrypted;");
        // If export failed, clean up the tmp file and propagate the error
        if let Err(e) = export_result {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(e);
        }

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


    pub fn remove_password(&mut self) -> Result<(), AppError> {
        if !self.encrypted {
            return Err(AppError::Validation("数据库未加密".into()));
        }

        // Use sqlcipher_export to create a plaintext copy of the encrypted database.
        // We create an empty plaintext SQLite file first, then ATTACH it without KEY
        // to avoid the KEY '' ambiguity that SQLCipher rejects.
        let tmp_path = self
            .path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join(".asset-snapshot-decrypting-tmp");

        // Remove any leftover tmp file and create a fresh empty plaintext database
        let _ = std::fs::remove_file(&tmp_path);
        {
            let tmp_conn = Connection::open(&tmp_path)
                .map_err(|e| AppError::Database(format!("无法创建临时数据库: {e}")))?;
            tmp_conn
                .execute_batch("PRAGMA cipher_compatibility = 4;")
                .map_err(|e| AppError::Database(e.to_string()))?;
            // No PRAGMA key set — this is a plaintext database
        }

        // Ensure any leftover attachment is cleaned up
        let _ = self.conn.execute_batch("DETACH DATABASE plaintext;");

        // ATTACH the plaintext database with KEY '' to override the encrypted main key
        self.conn
            .execute_batch(&format!(
                "ATTACH DATABASE '{}' AS plaintext KEY '';",
                tmp_path.to_string_lossy().replace('\'', "''")
            ))
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Export, always detaching on exit regardless of success or failure
        let export_result = self
            .conn
            .execute_batch("SELECT sqlcipher_export('plaintext');")
            .map_err(|e| AppError::Database(e.to_string()));
        let _ = self.conn.execute_batch("DETACH DATABASE plaintext;");

        if let Err(e) = export_result {
            let _ = std::fs::remove_file(&tmp_path);
            return Err(e);
        }

        // Replace the encrypted file with the plaintext copy
        std::fs::rename(&tmp_path, &self.path).map_err(|e| {
            let _ = std::fs::remove_file(&tmp_path);
            AppError::Database(format!("无法替换数据库文件: {e}"))
        })?;

        // Reopen the decrypted file without a password
        self.conn = Connection::open(&self.path)
            .map_err(|e| AppError::Database(format!("无法重新打开数据库: {e}")))?;
        self.conn
            .execute_batch("PRAGMA cipher_compatibility = 4;")
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Verify database is still readable after decryption
        self.conn
            .query_row(
                "SELECT count(*) FROM sqlite_master",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|e| {
                AppError::Database(format!("解密后数据库验证失败: {e}"))
            })?;

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

    pub fn create_blank_at(path: PathBuf) -> Result<Self> {
        if path.exists() {
            fs::remove_file(&path).with_context(|| {
                format!("failed to remove existing file at {}", path.display())
            })?;
        }
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!("failed to create directory {}", parent.display())
            })?;
        }
        let db = Self::open_path(path, None)?;
        db.remember_current_path()
            .map_err(|e| anyhow::anyhow!("failed to remember path: {e}"))?;
        Ok(db)
    }


    pub fn all_analyses(&self) -> Result<Vec<SnapshotAnalysis>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, snapshot_id FROM snapshot_analysis ORDER BY snapshot_id"
        )?;
        let analysis_rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })?;

        let mut result = Vec::new();
        for analysis_row in analysis_rows {
            let (analysis_id, snapshot_id) = analysis_row?;

            let mut item_stmt = self.conn.prepare(
                "SELECT id, type, name FROM analysis_items WHERE analysis_id = ?1 ORDER BY sort_order, id"
            )?;
            let item_rows = item_stmt.query_map(params![analysis_id], |row| {
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

            result.push(SnapshotAnalysis {
                snapshot_id,
                items,
            });
        }
        Ok(result)
    }

    pub fn dashboard_data(&self) -> Result<DashboardData, AppError> {
        Ok(DashboardData {
            platforms: self.platforms()?,
            accounts: self.accounts()?,
            snapshots: self.snapshots()?,
            summaries: self.snapshot_summaries()?,
            analyses: self.all_analyses()?,
        })
    }

    pub fn get_snapshots_page(&self, input: GetSnapshotsPageInput) -> Result<PaginatedSnapshots, AppError> {
        let total_count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM snapshots",
            [],
            |row| row.get(0),
        )?;

        let snapshots = self.paginated_snapshots(input.limit, input.offset)?;
        let summaries = self.paginated_snapshot_summaries(input.limit, input.offset)?;
        let snapshot_ids: Vec<i64> = snapshots.iter().map(|s| s.id).collect();
        let analyses = self.paginated_analyses(&snapshot_ids)?;

        Ok(PaginatedSnapshots {
            snapshots,
            summaries,
            analyses,
            total_count,
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
            "INSERT INTO snapshots (date, snapshot_time, note) VALUES (?1, ?2, ?3)",
            params![date, input.snapshot_time.as_deref().unwrap_or("00:00"), normalized_note(input.note.as_deref())],
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
            "UPDATE snapshots SET date = ?1, snapshot_time = ?2, note = ?3 WHERE id = ?4",
            params![
                date,
                input.snapshot_time.as_deref().unwrap_or("00:00"),
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
            "UPDATE platforms SET name = ?1, color = ?2 WHERE id = ?3",
            params![name, input.color.as_deref(), input.platform_id],
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

    pub fn update_account_type(&self, input: UpdateAccountTypeInput) -> Result<(), AppError> {
        let changed = self.conn.execute(
            "UPDATE accounts SET type = ?1 WHERE id = ?2",
            params![input.account_type.as_db(), input.account_id],
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
        Self::migrate_conn(&self.conn)
    }

    fn migrate_conn(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            r#"
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

        // Migrations: add columns that may not exist in older databases
        conn.execute_batch(
            r#"
            ALTER TABLE platforms ADD COLUMN color TEXT;
            ALTER TABLE snapshots ADD COLUMN snapshot_time TEXT DEFAULT '00:00';
            "#,
        )
        .ok();
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
            "INSERT INTO platforms (name, sort_order, color) VALUES (?1, ?2, ?3)",
            params!["招商银行", 2, "#EB5757"],
        )?;
        self.conn.execute(
            "INSERT INTO platforms (name, sort_order, color) VALUES (?1, ?2, ?3)",
            params!["微信", 3, "#27AE60"],
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
            .prepare("SELECT id, name, color, sort_order FROM platforms ORDER BY sort_order, id")?;
        let rows = stmt.query_map([], |row| {
            Ok(Platform {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                sort_order: row.get(3)?,
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
            .prepare("SELECT id, date, snapshot_time, note FROM snapshots ORDER BY date ASC, id ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
        let snapshots = rows.collect::<rusqlite::Result<Vec<_>>>()?;

        snapshots
            .into_iter()
            .map(|(id, date, snapshot_time, note)| {
                Ok(Snapshot {
                    id,
                    snapshot_time,
                    date,
                    note,
                    items: self.snapshot_items(id)?,
                })
            })
            .collect()
    }

    fn paginated_snapshots(&self, limit: i64, offset: i64) -> Result<Vec<Snapshot>, AppError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, date, snapshot_time, note FROM snapshots ORDER BY date ASC, id ASC LIMIT ?1 OFFSET ?2")?;
        let rows = stmt.query_map(params![limit, offset], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
        let snapshots = rows.collect::<rusqlite::Result<Vec<_>>>()?;

        snapshots
            .into_iter()
            .map(|(id, date, snapshot_time, note)| {
                Ok(Snapshot {
                    id,
                    snapshot_time,
                    date,
                    note,
                    items: self.snapshot_items(id)?,
                })
            })
            .collect()
    }

    fn paginated_snapshot_summaries(&self, limit: i64, offset: i64) -> Result<Vec<SnapshotSummary>, AppError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, date FROM snapshots ORDER BY date ASC, id ASC LIMIT ?1 OFFSET ?2")?;
        let snapshot_rows = stmt.query_map(params![limit, offset], |row| {
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

    fn paginated_analyses(&self, snapshot_ids: &[i64]) -> Result<Vec<SnapshotAnalysis>, AppError> {
        if snapshot_ids.is_empty() {
            return Ok(Vec::new());
        }
        let placeholders: Vec<String> = snapshot_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
        let sql = format!(
            "SELECT id, snapshot_id FROM snapshot_analysis WHERE snapshot_id IN ({}) ORDER BY snapshot_id",
            placeholders.join(", ")
        );
        let params: Vec<&dyn rusqlite::types::ToSql> = snapshot_ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
        let mut stmt = self.conn.prepare(&sql)?;
        let analysis_rows = stmt.query_map(params.as_slice(), |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })?;

        let mut result = Vec::new();
        for analysis_row in analysis_rows {
            let (analysis_id, snapshot_id) = analysis_row?;

            let mut item_stmt = self.conn.prepare(
                "SELECT id, type, name FROM analysis_items WHERE analysis_id = ?1 ORDER BY sort_order, id"
            )?;
            let item_rows = item_stmt.query_map(params![analysis_id], |row| {
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

            result.push(SnapshotAnalysis {
                snapshot_id,
                items,
            });
        }
        Ok(result)
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
    Ok(app_data_dir()?.join("asset-snapshot.asdb"))
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

#[cfg(test)]
mod tests {
    #![allow(unused_mut)]
    use super::*;
    use crate::models::CreateSnapshotItemInput;
    use rusqlite::Connection;


    fn test_db() -> AppDatabase {
        let conn = Connection::open_in_memory().unwrap();
        let db = AppDatabase {
            conn,
            path: PathBuf::from(":memory:"),
            encrypted: false,
        };
        db.migrate().unwrap();
        db
    }

    #[test]
    fn migration_creates_tables() {
        let mut db = test_db();
        let count: i64 = db
            .conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='platforms'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn create_and_list_platforms() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "支付宝".into() }).unwrap();
        db.create_platform(CreatePlatformInput { name: "招商银行".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        assert_eq!(platforms.len(), 2);
        assert_eq!(platforms[0].name, "支付宝");
        assert_eq!(platforms[1].name, "招商银行");
    }

    #[test]
    fn update_platform_name() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "支付宝".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.update_platform(UpdatePlatformInput { platform_id: platforms[0].id, name: "蚂蚁财富".into(), color: None }).unwrap();
        let platforms = db.platforms().unwrap();
        assert_eq!(platforms[0].name, "蚂蚁财富");
    }

    #[test]
    fn move_platform_sort_order() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "A".into() }).unwrap();
        db.create_platform(CreatePlatformInput { name: "B".into() }).unwrap();
        let platform_b_id = {
            let platforms = db.platforms().unwrap();
            assert_eq!(platforms[0].name, "A");
            assert_eq!(platforms[1].name, "B");
            platforms[1].id
        };
        db.move_platform(MovePlatformInput { platform_id: platform_b_id, direction: MoveDirection::Up }).unwrap();
        let platforms = db.platforms().unwrap();
        assert_eq!(platforms[0].name, "B");
        assert_eq!(platforms[1].name, "A");
    }

    #[test]
    fn create_account_with_type() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "理财".into(), account_type: AccountType::AssetNonliquid }).unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "花呗".into(), account_type: AccountType::Debt }).unwrap();
        let accounts = db.accounts().unwrap();
        assert_eq!(accounts.len(), 3);
        assert_eq!(accounts[0].account_type, AccountType::AssetLiquid);
        assert_eq!(accounts[1].account_type, AccountType::AssetNonliquid);
        assert_eq!(accounts[2].account_type, AccountType::Debt);
    }

    #[test]
    fn deactivate_account_excludes_from_active() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        let accounts = db.accounts().unwrap();
        assert!(accounts[0].is_active);
        db.update_account_active(UpdateAccountActiveInput { account_id: accounts[0].id, is_active: false }).unwrap();
        let accounts = db.accounts().unwrap();
        assert!(!accounts[0].is_active);
    }

    #[test]
    fn create_snapshot_and_recalculate() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "花呗".into(), account_type: AccountType::Debt }).unwrap();
        let accounts = db.accounts().unwrap();
        db.create_snapshot(CreateSnapshotInput {
            date: "2026-06-01".into(),
            snapshot_time: None,
            note: Some("测试快照".into()),
            items: vec![
                CreateSnapshotItemInput { account_id: accounts[0].id, amount: "10000.00".into() },
                CreateSnapshotItemInput { account_id: accounts[1].id, amount: "2000.00".into() },
            ],
        }).unwrap();
        let summaries = db.snapshot_summaries().unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].total_asset, "8000.00");
        assert_eq!(summaries[0].available_asset, "10000.00");
    }

    #[test]
    fn delete_snapshot_removes_items() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        let accounts = db.accounts().unwrap();
        db.create_snapshot(CreateSnapshotInput {
            date: "2026-06-01".into(), note: None,
            snapshot_time: None,
            items: vec![CreateSnapshotItemInput { account_id: accounts[0].id, amount: "5000.00".into() }],
        }).unwrap();
        let snapshots = db.snapshots().unwrap();
        db.delete_snapshot(DeleteSnapshotInput { snapshot_id: snapshots[0].id }).unwrap();
        let snapshots = db.snapshots().unwrap();
        assert!(snapshots.is_empty());
        let item_count: i64 = db.conn.query_row("SELECT count(*) FROM snapshot_items", [], |row| row.get(0)).unwrap();
        assert_eq!(item_count, 0);
    }

    #[test]
    fn update_snapshot_changes_items() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        let accounts = db.accounts().unwrap();
        db.create_snapshot(CreateSnapshotInput {
            date: "2026-06-01".into(), note: None,
            snapshot_time: None,
            items: vec![CreateSnapshotItemInput { account_id: accounts[0].id, amount: "5000.00".into() }],
        }).unwrap();
        let snapshots = db.snapshots().unwrap();
        db.update_snapshot(UpdateSnapshotInput {
            snapshot_id: snapshots[0].id,
            date: "2026-06-15".into(),
            snapshot_time: None,
            note: Some("更新".into()),
            items: vec![CreateSnapshotItemInput { account_id: accounts[0].id, amount: "8000.00".into() }],
        }).unwrap();
        let snapshots = db.snapshots().unwrap();
        assert_eq!(snapshots[0].date, "2026-06-15");
        assert_eq!(snapshots[0].note.as_deref(), Some("更新"));
        assert_eq!(snapshots[0].items[0].amount, "8000.00");
    }

    #[test]
    fn snapshot_analysis_save_and_load() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        let accounts = db.accounts().unwrap();
        db.create_snapshot(CreateSnapshotInput {
            date: "2026-06-01".into(), note: None,
            snapshot_time: None,
            items: vec![CreateSnapshotItemInput { account_id: accounts[0].id, amount: "10000.00".into() }],
        }).unwrap();
        let snapshots = db.snapshots().unwrap();
        db.save_snapshot_analysis(SnapshotAnalysis {
            snapshot_id: snapshots[0].id,
            items: vec![AnalysisItem { item_type: AnalysisItemType::Income, name: "工资".into(), amounts: vec!["5000.00".into()] }],
        }).unwrap();
        let analysis = db.snapshot_analysis(GetSnapshotAnalysisInput { snapshot_id: snapshots[0].id }).unwrap();
        assert_eq!(analysis.items.len(), 1);
        assert_eq!(analysis.items[0].name, "工资");
        assert_eq!(analysis.items[0].amounts, vec!["5000.00"]);
    }

    #[test]
    fn validate_snapshot_date_rejects_empty() {
        assert!(validate_snapshot_date("").is_err());
        assert!(validate_snapshot_date("   ").is_err());
    }

    #[test]
    fn validate_snapshot_date_rejects_bad_format() {
        assert!(validate_snapshot_date("2026/06/01").is_err());
        assert!(validate_snapshot_date("2026-13-01").is_err());
        assert!(validate_snapshot_date("not-a-date").is_err());
    }

    #[test]
    fn validate_snapshot_date_accepts_valid() {
        assert!(validate_snapshot_date("2026-06-01").is_ok());
        assert!(validate_snapshot_date("2026-12-31").is_ok());
        assert!(validate_snapshot_date("2024-02-29").is_ok());
    }

    #[test]
    fn validate_snapshot_items_rejects_empty() {
        assert!(validate_snapshot_items(&[]).is_err());
    }

    #[test]
    fn validate_snapshot_items_rejects_bad_amount() {
        assert!(validate_snapshot_items(&[CreateSnapshotItemInput { account_id: 1, amount: "abc".into() }]).is_err());
    }

    #[test]
    fn validate_snapshot_items_accepts_valid() {
        assert!(validate_snapshot_items(&[CreateSnapshotItemInput { account_id: 1, amount: "5000.00".into() }]).is_ok());
    }

    #[test]
    fn delete_account_without_history_succeeds() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        let accounts = db.accounts().unwrap();
        db.delete_account(DeleteAccountInput { account_id: accounts[0].id }).unwrap();
        let accounts = db.accounts().unwrap();
        assert!(accounts.is_empty());
    }

    #[test]
    fn delete_account_with_history_rejected() {
        let mut db = test_db();
        db.create_platform(CreatePlatformInput { name: "P".into() }).unwrap();
        let platforms = db.platforms().unwrap();
        db.create_account(CreateAccountInput { platform_id: platforms[0].id, name: "余额".into(), account_type: AccountType::AssetLiquid }).unwrap();
        let accounts = db.accounts().unwrap();
        db.create_snapshot(CreateSnapshotInput {
            date: "2026-06-01".into(), note: None,
            snapshot_time: None,
            items: vec![CreateSnapshotItemInput { account_id: accounts[0].id, amount: "5000.00".into() }],
        }).unwrap();        let result = db.delete_account(DeleteAccountInput { account_id: accounts[0].id });
        assert!(result.is_err());
    }
}
