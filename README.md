# Asset Snapshot

A local-first personal asset snapshot and trend analysis tool built with Tauri + React.

## Overview

Asset Snapshot records your asset distribution at specific points in time, automatically calculates total and available assets, and visualizes trends — without tracking individual transactions.

### What it does

- Record asset snapshots with per-account balances
- Auto-calculate total assets, available assets, and platform distributions
- Visualize asset trends over time with interactive charts
- Explain asset changes between snapshots with income/expense breakdowns
- Optional AES-256 encryption via SQLCipher with Argon2 key derivation

### What it doesn't do

- No transaction tracking
- No expense categorization
- No budgeting
- No automatic imports

## Tech Stack

- **Desktop Framework**: Tauri 2
- **Frontend**: React + TypeScript + Tailwind CSS
- **Charts**: Recharts
- **Database**: SQLite / SQLCipher (AES-256)
- **Backend**: Rust

## Features

- Local-first, single-file SQLite database
- Optional encryption with brute-force protection (exponential backoff)
- Multi-platform asset tracking (e.g. Alipay, bank accounts, WeChat)
- Configurable account types: liquid assets, non-liquid assets, debt
- Historical snapshots with date+time precision
- Platform color customization for charts
- Dark mode with system preference detection
- Data file management: open, create, backup, export
- Snapshot change analysis with income/expense breakdowns

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/) toolchain
- System dependencies for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Development

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

## Project Structure

```
src/            # React frontend
src-tauri/      # Rust backend
  src/
    db.rs       # SQLite operations
    lib.rs      # Tauri commands
    models.rs   # Data models
    calculations.rs  # Asset summation logic
```

## License

MIT
