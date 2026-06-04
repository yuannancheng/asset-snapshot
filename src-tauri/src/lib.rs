mod calculations;
mod db;
mod models;

use db::AppDatabase;
use models::{
    AppError, BackupDataFileInput, ChangePasswordInput, CreateAccountInput, CreatePlatformInput,
    CreateSnapshotInput, DashboardData, DataFileInfo, DatabaseStatus, DeleteAccountInput,
    DeletePlatformInput, DeleteSnapshotInput, GetSnapshotAnalysisInput, MoveAccountInput,
    MovePlatformInput, SetPasswordInput, SnapshotAnalysis, SwitchDataFileInput,
    UnlockInput, UpdateAccountActiveInput, UpdateAccountInput, UpdatePlatformInput,
    UpdateSnapshotInput, MIN_PASSWORD_LENGTH,
};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

const DATA_FILE_SWITCHED_EVENT: &str = "data-file-switched";
const DATA_FILE_OPEN_ERROR_EVENT: &str = "data-file-open-error";
const DATA_FILE_ENCRYPTED_EVENT: &str = "data-file-encrypted";

enum DatabaseState {
    Locked {
        path: PathBuf,
        failed_attempts: u32,
        last_failed_at: Option<std::time::Instant>,
    },
    Unlocked(AppDatabase),
}

fn wait_seconds(failed_attempts: u32, last_failed_at: Option<std::time::Instant>) -> u32 {
    if failed_attempts == 0 {
        return 0;
    }
    let required = std::cmp::min(1u64 << failed_attempts, 30);
    let elapsed = last_failed_at.map_or(required, |t| t.elapsed().as_secs());
    required.saturating_sub(elapsed) as u32
}

struct AppState {
    db_state: Mutex<DatabaseState>,
}

fn require_unlocked<'a>(
    db_state: &'a mut DatabaseState,
) -> Result<&'a mut AppDatabase, AppError> {
    match db_state {
        DatabaseState::Unlocked(db) => Ok(db),
        DatabaseState::Locked { .. } => Err(AppError::AuthenticationRequired),
    }
}

#[tauri::command]
fn get_dashboard_data(state: tauri::State<'_, AppState>) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    require_unlocked(&mut db_state)?.dashboard_data()
}

#[tauri::command]
fn get_data_file_info(state: tauri::State<'_, AppState>) -> Result<DataFileInfo, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    Ok(data_file_info(db))
}

#[tauri::command]
fn get_database_status(state: tauri::State<'_, AppState>) -> Result<DatabaseStatus, AppError> {
    let db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    match &*db_state {
        DatabaseState::Locked {
            path,
            failed_attempts,
            last_failed_at,
        } => Ok(DatabaseStatus {
            current_path: path.to_string_lossy().into_owned(),
            encrypted: true,
            locked: true,
            failed_attempts: *failed_attempts,
            wait_seconds: wait_seconds(*failed_attempts, *last_failed_at),
        }),
        DatabaseState::Unlocked(db) => Ok(DatabaseStatus {
            current_path: db.current_path().to_string_lossy().into_owned(),
            encrypted: db.is_encrypted(),
            locked: false,
            failed_attempts: 0,
            wait_seconds: 0,
        }),
    }
}

#[tauri::command]
fn set_database_password(
    state: tauri::State<'_, AppState>,
    input: SetPasswordInput,
) -> Result<DatabaseStatus, AppError> {
    if input.password.len() < MIN_PASSWORD_LENGTH {
        return Err(AppError::InvalidPassword(MIN_PASSWORD_LENGTH));
    }
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.set_password(&input.password)?;
    Ok(DatabaseStatus {
        current_path: db.current_path().to_string_lossy().into_owned(),
        encrypted: true,
        locked: false,
        failed_attempts: 0,
        wait_seconds: 0,
    })
}

#[tauri::command]
fn change_database_password(
    state: tauri::State<'_, AppState>,
    input: ChangePasswordInput,
) -> Result<(), AppError> {
    if input.new_password.len() < MIN_PASSWORD_LENGTH {
        return Err(AppError::InvalidPassword(MIN_PASSWORD_LENGTH));
    }
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.change_password(&input.new_password)?;
    db.remember_current_path()?;
    Ok(())
}

#[tauri::command]
fn unlock_database(
    state: tauri::State<'_, AppState>,
    input: UnlockInput,
) -> Result<DashboardData, AppError> {
    let db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;

    let (path, delay_remaining) = match &*db_state {
        DatabaseState::Locked {
            path,
            failed_attempts,
            last_failed_at,
        } => {
            let remaining = wait_seconds(*failed_attempts, *last_failed_at);
            if remaining > 0 {
                (path.clone(), remaining)
            } else {
                (path.clone(), 0)
            }
        }
        DatabaseState::Unlocked(_) => {
            return Err(AppError::Validation("数据库已经解锁".into()));
        }
    };

    if delay_remaining > 0 {
        return Err(AppError::WaitRequired(delay_remaining));
    }
    drop(db_state);

    match AppDatabase::open_path(path.clone(), Some(&input.password)) {
        Ok(db) => {
            let data = db.dashboard_data()?;
            db.remember_current_path()?;
            let mut db_state =
                state.db_state.lock().map_err(|_| AppError::StateLocked)?;
            *db_state = DatabaseState::Unlocked(db);
            Ok(data)
        }
        Err(e) => {
            let mut db_state =
                state.db_state.lock().map_err(|_| AppError::StateLocked)?;
            if let DatabaseState::Locked {
                ref mut failed_attempts,
                ref mut last_failed_at,
                ..
            } = &mut *db_state
            {
                *failed_attempts += 1;
                *last_failed_at = Some(std::time::Instant::now());
            }
            if e.to_string().contains("authentication failed") {
                let wait = wait_seconds(
                    if let DatabaseState::Locked {
                        failed_attempts, ..
                    } = &*db_state
                    {
                        *failed_attempts
                    } else {
                        0
                    },
                    Some(std::time::Instant::now()),
                );
                Err(AppError::AuthenticationFailedWait(wait))
            } else {
                Err(AppError::Database(e.to_string()))
            }
        }
    }
}

#[tauri::command]
fn lock_database(
    state: tauri::State<'_, AppState>,
) -> Result<DatabaseStatus, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    match &*db_state {
        DatabaseState::Unlocked(db) => {
            let path = db.current_path().to_path_buf();
            let encrypted = db.is_encrypted();
            // Drop the unlocked database, closing the connection
            *db_state = DatabaseState::Locked {
                path,
                failed_attempts: 0,
                last_failed_at: None,
            };
            Ok(DatabaseStatus {
                current_path: encrypted
                    .then(|| "".into())
                    .unwrap_or_default(),
                encrypted,
                locked: true,
                failed_attempts: 0,
                wait_seconds: 0,
            })
        }
        DatabaseState::Locked { .. } => Err(AppError::Validation("数据库未解锁".into())),
    }
}

#[tauri::command]
fn switch_data_file(
    state: tauri::State<'_, AppState>,
    input: SwitchDataFileInput,
) -> Result<DashboardData, AppError> {
    let path = normalized_path(&input.path)?;
    match AppDatabase::open_path(path.clone(), input.password.as_deref()) {
        Ok(next_db) => {
            let next_data = next_db.dashboard_data()?;
            next_db.remember_current_path()?;
            let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
            *db_state = DatabaseState::Unlocked(next_db);
            Ok(next_data)
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("authentication required")
                || msg.contains("authentication failed")
            {
                let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
                *db_state = DatabaseState::Locked {
                    path,
                    failed_attempts: 0,
                    last_failed_at: None,
                };
                Err(AppError::AuthenticationRequired)
            } else {
                Err(AppError::Database(msg))
            }
        }
    }
}

#[tauri::command]
fn backup_data_file(
    state: tauri::State<'_, AppState>,
    input: BackupDataFileInput,
) -> Result<DataFileInfo, AppError> {
    let path = normalized_path(&input.path)?;
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.backup_to(&path)?;
    Ok(data_file_info(db))
}

#[tauri::command]
fn create_platform(
    state: tauri::State<'_, AppState>,
    input: CreatePlatformInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.create_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn create_account(
    state: tauri::State<'_, AppState>,
    input: CreateAccountInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.create_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn create_snapshot(
    state: tauri::State<'_, AppState>,
    input: CreateSnapshotInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.create_snapshot(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_snapshot(
    state: tauri::State<'_, AppState>,
    input: UpdateSnapshotInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.update_snapshot(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn delete_snapshot(
    state: tauri::State<'_, AppState>,
    input: DeleteSnapshotInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.delete_snapshot(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_account_active(
    state: tauri::State<'_, AppState>,
    input: UpdateAccountActiveInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.update_account_active(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_platform(
    state: tauri::State<'_, AppState>,
    input: UpdatePlatformInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.update_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn move_platform(
    state: tauri::State<'_, AppState>,
    input: MovePlatformInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.move_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_account(
    state: tauri::State<'_, AppState>,
    input: UpdateAccountInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.update_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn move_account(
    state: tauri::State<'_, AppState>,
    input: MoveAccountInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.move_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn delete_account(
    state: tauri::State<'_, AppState>,
    input: DeleteAccountInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.delete_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn delete_platform(
    state: tauri::State<'_, AppState>,
    input: DeletePlatformInput,
) -> Result<DashboardData, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.delete_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn get_snapshot_analysis(
    state: tauri::State<'_, AppState>,
    input: GetSnapshotAnalysisInput,
) -> Result<SnapshotAnalysis, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.snapshot_analysis(input)
}

#[tauri::command]
fn save_snapshot_analysis(
    state: tauri::State<'_, AppState>,
    input: SnapshotAnalysis,
) -> Result<SnapshotAnalysis, AppError> {
    let mut db_state = state.db_state.lock().map_err(|_| AppError::StateLocked)?;
    let db = require_unlocked(&mut db_state)?;
    db.save_snapshot_analysis(input)
}

pub fn run() {
    let db_state = open_initial_database().expect("failed to open application database");

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            focus_main_window(app);

            if let Some(path) = data_file_path_from_args(args) {
                match switch_to_data_file(app, path) {
                    Ok(info) => {
                        let _ = app.emit(DATA_FILE_SWITCHED_EVENT, info);
                    }
                    Err(error) => {
                        if matches!(error, AppError::AuthenticationRequired) {
                            let _ = app
                                .emit(DATA_FILE_ENCRYPTED_EVENT, "encrypted file requires password");
                        } else {
                            let _ = app.emit(DATA_FILE_OPEN_ERROR_EVENT, error.to_string());
                        }
                    }
                }
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            db_state: Mutex::new(db_state),
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_data,
            get_data_file_info,
            get_database_status,
            set_database_password,
            change_database_password,
            unlock_database,
            lock_database,
            switch_data_file,
            backup_data_file,
            create_platform,
            create_account,
            create_snapshot,
            update_snapshot,
            delete_snapshot,
            update_account_active,
            update_platform,
            move_platform,
            update_account,
            move_account,
            delete_account,
            delete_platform,
            get_snapshot_analysis,
            save_snapshot_analysis
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn open_initial_database() -> Result<DatabaseState, anyhow::Error> {
    // Check if there's a .as file from command-line args
    if let Some(path) = data_file_path_from_args(std::env::args_os()) {
        return open_or_lock_path(path);
    }

    // Read config for last-used path and encryption status
    let encrypted = db::read_config_encrypted()?;
    let path = match configured_database_path_for_startup()? {
        Some(path) => path,
        None => default_database_path_for_startup()?,
    };

    if encrypted {
        return Ok(DatabaseState::Locked {
            path,
            failed_attempts: 0,
            last_failed_at: None,
        });
    }

    open_or_lock_path(path)
}

fn open_or_lock_path(path: PathBuf) -> Result<DatabaseState, anyhow::Error> {
    match AppDatabase::open_path(path.clone(), None) {
        Ok(db) => {
            db.remember_current_path()?;
            Ok(DatabaseState::Unlocked(db))
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("authentication required")
                || msg.contains("authentication failed")
            {
                Ok(DatabaseState::Locked {
                    path,
                    failed_attempts: 0,
                    last_failed_at: None,
                })
            } else {
                Err(e)
            }
        }
    }
}

fn switch_to_data_file(app: &tauri::AppHandle, path: PathBuf) -> Result<DataFileInfo, AppError> {
    match AppDatabase::open_path(path.clone(), None) {
        Ok(next_db) => {
            next_db.remember_current_path()?;
            let info = data_file_info(&next_db);
            let state = app.state::<AppState>();
            let mut db_state = state
                .db_state
                .lock()
                .map_err(|_| AppError::StateLocked)?;
            *db_state = DatabaseState::Unlocked(next_db);
            Ok(info)
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("authentication required")
                || msg.contains("authentication failed")
            {
                let state = app.state::<AppState>();
                let mut db_state = state
                    .db_state
                    .lock()
                    .map_err(|_| AppError::StateLocked)?;
                *db_state = DatabaseState::Locked {
                    path,
                    failed_attempts: 0,
                    last_failed_at: None,
                };
                Err(AppError::AuthenticationRequired)
            } else {
                Err(AppError::Database(msg))
            }
        }
    }
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn data_file_info(db: &AppDatabase) -> DataFileInfo {
    DataFileInfo {
        current_path: db.current_path().to_string_lossy().into_owned(),
    }
}

fn data_file_path_from_args<I, S>(args: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    args.into_iter()
        .map(|arg| PathBuf::from(arg.as_ref()))
        .find(|path| {
            path.extension()
                .and_then(OsStr::to_str)
                .is_some_and(|extension| extension.eq_ignore_ascii_case("as"))
        })
}

fn normalized_path(path: &str) -> Result<PathBuf, AppError> {
    let path = path.trim();
    if path.is_empty() {
        return Err(AppError::Validation("数据文件路径不能为空".into()));
    }
    Ok(PathBuf::from(path))
}

fn configured_database_path_for_startup() -> Result<Option<PathBuf>, anyhow::Error> {
    let path = app_config_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let Ok(content) = std::fs::read_to_string(&path) else {
        return Ok(None);
    };
    #[derive(serde::Deserialize)]
    struct Config {
        #[serde(default)]
        current_path: String,
    }
    let Ok(config) = serde_json::from_str::<Config>(&content) else {
        return Ok(None);
    };
    let current_path = config.current_path.trim();
    if current_path.is_empty() {
        return Ok(None);
    }
    Ok(Some(PathBuf::from(current_path)))
}

fn default_database_path_for_startup() -> Result<PathBuf, anyhow::Error> {
    use directories::ProjectDirs;
    let dirs = ProjectDirs::from("com", "asset-snapshot", "asset-snapshot")
        .ok_or_else(|| anyhow::anyhow!("failed to resolve application data directory"))?;
    Ok(dirs.data_local_dir().join("asset-snapshot.db"))
}

fn app_config_path() -> Result<PathBuf, anyhow::Error> {
    use directories::ProjectDirs;
    let dirs = ProjectDirs::from("com", "asset-snapshot", "asset-snapshot")
        .ok_or_else(|| anyhow::anyhow!("failed to resolve application data directory"))?;
    Ok(dirs.data_local_dir().join("data-file.json"))
}
