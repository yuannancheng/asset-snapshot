mod calculations;
mod db;
mod models;

use db::AppDatabase;
use models::{
    AppError, CreateAccountInput, CreatePlatformInput, CreateSnapshotInput, DashboardData,
    DeleteAccountInput, DeletePlatformInput, DeleteSnapshotInput, UpdateAccountActiveInput,
    UpdateSnapshotInput,
};
use std::sync::Mutex;

struct AppState {
    db: Mutex<AppDatabase>,
}

#[tauri::command]
fn get_dashboard_data(state: tauri::State<'_, AppState>) -> Result<DashboardData, AppError> {
    let db = state.db.lock().map_err(|_| AppError::StateLocked)?;
    db.dashboard_data()
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

pub fn run() {
    let db = AppDatabase::open_default().expect("failed to open application database");

    tauri::Builder::default()
        .manage(AppState { db: Mutex::new(db) })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_data,
            create_platform,
            create_account,
            create_snapshot,
            update_snapshot,
            delete_snapshot,
            update_account_active,
            delete_account,
            delete_platform
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
