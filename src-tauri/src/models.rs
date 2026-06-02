use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("database error: {0}")]
    Database(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("application state is locked")]
    StateLocked,
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Database(value.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        Self::Database(value.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Platform {
    pub id: i64,
    pub name: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountType {
    AssetLiquid,
    AssetNonliquid,
    Debt,
}

impl AccountType {
    pub fn from_db(value: &str) -> Self {
        match value {
            "asset_liquid" => Self::AssetLiquid,
            "asset_nonliquid" => Self::AssetNonliquid,
            "debt" => Self::Debt,
            _ => Self::AssetLiquid,
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::AssetLiquid => "asset_liquid",
            Self::AssetNonliquid => "asset_nonliquid",
            Self::Debt => "debt",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub platform_id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub account_type: AccountType,
    pub sort_order: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone)]
pub struct SnapshotItemForCalc {
    pub platform_id: i64,
    pub platform_name: String,
    pub account_type: AccountType,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformAsset {
    pub platform_id: i64,
    pub platform_name: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotItem {
    pub account_id: i64,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: i64,
    pub date: String,
    pub note: Option<String>,
    pub items: Vec<SnapshotItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotSummary {
    pub snapshot_id: i64,
    pub date: String,
    pub total_asset: String,
    pub available_asset: String,
    pub platform_assets: Vec<PlatformAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub platforms: Vec<Platform>,
    pub accounts: Vec<Account>,
    pub snapshots: Vec<Snapshot>,
    pub summaries: Vec<SnapshotSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisItemType {
    Income,
    Expense,
}

impl AnalysisItemType {
    pub fn from_db(value: &str) -> Self {
        match value {
            "expense" => Self::Expense,
            _ => Self::Income,
        }
    }

    pub fn as_db(&self) -> &'static str {
        match self {
            Self::Income => "income",
            Self::Expense => "expense",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisItem {
    #[serde(rename = "type")]
    pub item_type: AnalysisItemType,
    pub name: String,
    pub amounts: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotAnalysis {
    pub snapshot_id: i64,
    pub items: Vec<AnalysisItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFileInfo {
    pub current_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlatformInput {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountInput {
    pub platform_id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub account_type: AccountType,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnapshotItemInput {
    pub account_id: i64,
    pub amount: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSnapshotInput {
    pub date: String,
    pub note: Option<String>,
    pub items: Vec<CreateSnapshotItemInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSnapshotInput {
    pub snapshot_id: i64,
    pub date: String,
    pub note: Option<String>,
    pub items: Vec<CreateSnapshotItemInput>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSnapshotInput {
    pub snapshot_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountActiveInput {
    pub account_id: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlatformInput {
    pub platform_id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovePlatformInput {
    pub platform_id: i64,
    pub direction: MoveDirection,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountInput {
    pub account_id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveAccountInput {
    pub account_id: i64,
    pub direction: MoveDirection,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MoveDirection {
    Up,
    Down,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAccountInput {
    pub account_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePlatformInput {
    pub platform_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSnapshotAnalysisInput {
    pub snapshot_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchDataFileInput {
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDataFileInput {
    pub path: String,
}
