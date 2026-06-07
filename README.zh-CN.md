# 资产快照

一款本地优先的个人资产快照与趋势分析工具，基于 Tauri + React 构建。

## 概览

资产快照在特定时间点记录资产分布，自动计算总资产和可用资产，并通过交互式图表展示趋势——不追踪每笔流水。

### 核心功能

- 按账户记录资产快照余额
- 自动计算总资产、可用资产和平台分布
- 通过交互式图表可视化资产趋势
- 用收入/支出明细解释快照间的资产变化
- 可选 AES-256 加密（SQLCipher），采用 Argon2 密钥派生

### 不做什么

- 不做流水记录
- 不做消费分类
- 不做预算系统
- 不做自动导入

## 技术栈

- **桌面框架**：Tauri 2
- **前端**：React + TypeScript + Tailwind CSS
- **图表**：Recharts
- **数据库**：SQLite / SQLCipher（AES-256）
- **后端**：Rust

## 功能特性

- 本地优先，单文件 SQLite 数据库
- 可选加密，暴力破解防护（指数退避延迟）
- 多平台资产管理（如支付宝、银行卡、微信等）
- 可配置账户类型：流动资产、非流动资产、负债
- 历史快照精确到分钟
- 平台自定义配色，图表中体现
- 暗色模式，支持跟随系统主题
- 数据文件管理：打开、新建、备份、导出
- 快照变动分析：收入/支出明细自动归因

## 开始使用

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) 工具链
- Tauri 系统依赖（参见 [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)）

### 开发

```bash
npm install
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

## 项目结构

```
src/            # React 前端
src-tauri/      # Rust 后端
  src/
    db.rs       # SQLite 操作
    lib.rs      # Tauri 命令
    models.rs   # 数据模型
    calculations.rs  # 资产汇总计算
```

## 许可

MIT
