use crate::models::{AccountType, PlatformAsset, SnapshotItemForCalc};
use rust_decimal::Decimal;
use std::collections::BTreeMap;
use std::str::FromStr;

pub struct CalculatedSnapshot {
    pub total_asset: String,
    pub available_asset: String,
    pub platform_assets: Vec<PlatformAsset>,
}

pub fn calculate_snapshot(items: &[SnapshotItemForCalc]) -> CalculatedSnapshot {
    let mut total_asset = Decimal::ZERO;
    let mut available_asset = Decimal::ZERO;
    let mut platform_assets = BTreeMap::<i64, (String, Decimal)>::new();

    for item in items {
        let amount = Decimal::from_str(&item.amount).unwrap_or(Decimal::ZERO);
        let signed_for_total = match item.account_type {
            AccountType::AssetLiquid => {
                available_asset += amount;
                amount
            }
            AccountType::AssetNonliquid => amount,
            AccountType::Debt => -amount,
        };

        total_asset += signed_for_total;
        let entry = platform_assets
            .entry(item.platform_id)
            .or_insert_with(|| (item.platform_name.clone(), Decimal::ZERO));
        entry.1 += signed_for_total;
    }

    CalculatedSnapshot {
        total_asset: total_asset.round_dp(2).to_string(),
        available_asset: available_asset.round_dp(2).to_string(),
        platform_assets: platform_assets
            .into_iter()
            .map(|(platform_id, (platform_name, amount))| PlatformAsset {
                platform_id,
                platform_name,
                amount: amount.round_dp(2).to_string(),
            })
            .collect(),
    }
}
