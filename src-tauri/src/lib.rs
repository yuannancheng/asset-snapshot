mod calculations;
mod db;
mod models;

use db::AppDatabase;
use models::{
    AppError, BackupDataFileInput, CreateAccountInput, CreatePlatformInput, CreateSnapshotInput,
    DashboardData, DataFileInfo, DeleteAccountInput, DeletePlatformInput, DeleteSnapshotInput,
    GetSnapshotAnalysisInput, MoveAccountInput, MovePlatformInput, SnapshotAnalysis,
    SwitchDataFileInput, UpdateAccountActiveInput, UpdateAccountInput, UpdatePlatformInput,
    UpdateSnapshotInput,
};
use std::ffi::OsStr;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

const DATA_FILE_SWITCHED_EVENT: &str = "data-file-switched";
const DATA_FILE_OPEN_ERROR_EVENT: &str = "data-file-open-error";

struct AppState {
    db: Mutex<AppDatabase>,
}

#[tauri::command]
fn get_dashboard_data(state: tauri::State<'_, AppState>) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.dashboard_data()
}

#[tauri::command]
fn get_data_file_info(state: tauri::State<'_, AppState>) -> Result<DataFileInfo, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    Ok(data_file_info(&db))
}

#[tauri::command]
fn switch_data_file(
    state: tauri::State<'_, AppState>,
    input: SwitchDataFileInput,
) -> Result<DashboardData, AppError> {
    let path = normalized_path(&input.path)?;
    let next_db = AppDatabase::open_path(path)?;
    let next_data = next_db.dashboard_data()?;
    next_db.remember_current_path()?;
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    *db = next_db;
    Ok(next_data)
}

#[tauri::command]
fn backup_data_file(
    state: tauri::State<'_, AppState>,
    input: BackupDataFileInput,
) -> Result<DataFileInfo, AppError> {
    let path = normalized_path(&input.path)?;
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.backup_to(&path)?;
    Ok(data_file_info(&db))
}

#[tauri::command]
fn create_platform(
    state: tauri::State<'_, AppState>,
    input: CreatePlatformInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.create_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn create_account(
    state: tauri::State<'_, AppState>,
    input: CreateAccountInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.create_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn create_snapshot(
    state: tauri::State<'_, AppState>,
    input: CreateSnapshotInput,
) -> Result<DashboardData, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.create_snapshot(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_snapshot(
    state: tauri::State<'_, AppState>,
    input: UpdateSnapshotInput,
) -> Result<DashboardData, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.update_snapshot(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn delete_snapshot(
    state: tauri::State<'_, AppState>,
    input: DeleteSnapshotInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.delete_snapshot(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_account_active(
    state: tauri::State<'_, AppState>,
    input: UpdateAccountActiveInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.update_account_active(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_platform(
    state: tauri::State<'_, AppState>,
    input: UpdatePlatformInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.update_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn move_platform(
    state: tauri::State<'_, AppState>,
    input: MovePlatformInput,
) -> Result<DashboardData, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.move_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn update_account(
    state: tauri::State<'_, AppState>,
    input: UpdateAccountInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.update_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn move_account(
    state: tauri::State<'_, AppState>,
    input: MoveAccountInput,
) -> Result<DashboardData, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.move_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn delete_account(
    state: tauri::State<'_, AppState>,
    input: DeleteAccountInput,
) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.delete_account(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn delete_platform(
    state: tauri::State<'_, AppState>,
    input: DeletePlatformInput,
) -> Result<DashboardData, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.delete_platform(input)?;
    db.dashboard_data()
}

#[tauri::command]
fn get_snapshot_analysis(
    state: tauri::State<'_, AppState>,
    input: GetSnapshotAnalysisInput,
) -> Result<SnapshotAnalysis, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.snapshot_analysis(input)
}

#[tauri::command]
fn save_snapshot_analysis(
    state: tauri::State<'_, AppState>,
    input: SnapshotAnalysis,
) -> Result<SnapshotAnalysis, AppError> {
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.save_snapshot_analysis(input)
}

pub fn run() {
    let db = open_initial_database().expect("failed to open application database");

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
                        let _ = app.emit(DATA_FILE_OPEN_ERROR_EVENT, error.to_string());
                    }
                }
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_data,
            get_data_file_info,
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

fn open_initial_database() -> Result<AppDatabase, anyhow::Error> {
    if let Some(path) = data_file_path_from_args(std::env::args_os()) {
        let db = AppDatabase::open_path(path)?;
        db.remember_current_path()?;
        return Ok(db);
    }

    AppDatabase::open_default()
}

fn switch_to_data_file(app: &tauri::AppHandle, path: PathBuf) -> Result<DataFileInfo, AppError> {
    let next_db = AppDatabase::open_path(path)?;
    next_db.remember_current_path()?;
    let info = data_file_info(&next_db);

    let state = app.state::<AppState>();
    let mut db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    *db = next_db;

    Ok(info)
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
