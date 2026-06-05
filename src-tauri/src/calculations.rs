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

#[cfg(test)]
mod tests {
    use super::*;

    fn item(platform_id: i64, platform_name: &str, account_type: AccountType, amount: &str) -> SnapshotItemForCalc {
        SnapshotItemForCalc {
            platform_id,
            platform_name: platform_name.to_string(),
            account_type,
            amount: amount.to_string(),
        }
    }

    #[test]
    fn empty_items_gives_zero() {
        let result = calculate_snapshot(&[]);
        assert_eq!(result.total_asset, "0");
        assert_eq!(result.available_asset, "0");
        assert!(result.platform_assets.is_empty());
    }

    #[test]
    fn single_liquid_asset() {
        let items = [item(1, "支付宝", AccountType::AssetLiquid, "5000.00")];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "5000.00");
        assert_eq!(result.available_asset, "5000.00");
        assert_eq!(result.platform_assets.len(), 1);
        assert_eq!(result.platform_assets[0].platform_name, "支付宝");
        assert_eq!(result.platform_assets[0].amount, "5000.00");
    }

    #[test]
    fn single_nonliquid_asset() {
        let items = [item(1, "支付宝", AccountType::AssetNonliquid, "10000.00")];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "10000.00");
        assert_eq!(result.available_asset, "0");
    }

    #[test]
    fn single_debt_reduces_total() {
        let items = [item(1, "支付宝", AccountType::Debt, "3000.00")];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "-3000.00");
        assert_eq!(result.available_asset, "0");
    }

    #[test]
    fn mixed_account_types() {
        let items = [
            item(1, "支付宝", AccountType::AssetLiquid, "5000.00"),
            item(1, "支付宝", AccountType::AssetNonliquid, "10000.00"),
            item(1, "支付宝", AccountType::Debt, "2000.00"),
        ];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "13000.00");
        assert_eq!(result.available_asset, "5000.00");
    }

    #[test]
    fn multiple_platforms_aggregated() {
        let items = [
            item(1, "支付宝", AccountType::AssetLiquid, "3000.00"),
            item(1, "支付宝", AccountType::AssetNonliquid, "5000.00"),
            item(2, "招商银行", AccountType::AssetLiquid, "10000.00"),
            item(2, "招商银行", AccountType::Debt, "1000.00"),
        ];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "17000.00");
        assert_eq!(result.available_asset, "13000.00");
        assert_eq!(result.platform_assets.len(), 2);
        let alipay = result.platform_assets.iter().find(|p| p.platform_id == 1).unwrap();
        assert_eq!(alipay.amount, "8000.00");
        let cmb = result.platform_assets.iter().find(|p| p.platform_id == 2).unwrap();
        assert_eq!(cmb.amount, "9000.00");
    }

    #[test]
    fn invalid_amount_treated_as_zero() {
        let items = [
            item(1, "支付宝", AccountType::AssetLiquid, "5000.00"),
            item(1, "支付宝", AccountType::AssetLiquid, "not-a-number"),
        ];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "5000.00");
        assert_eq!(result.available_asset, "5000.00");
    }

    #[test]
    fn negative_amount_on_asset_works() {
        let items = [item(1, "支付宝", AccountType::AssetLiquid, "-500.00")];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "-500.00");
        assert_eq!(result.available_asset, "-500.00");
    }

    #[test]
    fn negative_debt_increases_total() {
        let items = [item(1, "支付宝", AccountType::Debt, "-200.00")];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "200.00");
        assert_eq!(result.available_asset, "0");
    }

    #[test]
    fn rounding_to_two_decimals() {
        let items = [item(1, "支付宝", AccountType::AssetLiquid, "100.015")];
        let result = calculate_snapshot(&items);
        assert_eq!(result.total_asset, "100.02");
    }

    #[test]
    fn platform_assets_sorted_by_platform_id() {
        let items = [
            item(3, "微信", AccountType::AssetLiquid, "100.00"),
            item(1, "支付宝", AccountType::AssetLiquid, "200.00"),
            item(2, "招商银行", AccountType::AssetLiquid, "300.00"),
        ];
        let result = calculate_snapshot(&items);
        let ids: Vec<i64> = result.platform_assets.iter().map(|p| p.platform_id).collect();
        assert_eq!(ids, vec![1, 2, 3]);
    }
}
