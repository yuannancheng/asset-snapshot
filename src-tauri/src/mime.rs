use std::path::PathBuf;
use std::process::Command;

/// MIME XML definition for .asdb files (Asset Snapshot Data)
const MIME_XML: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/vnd.asset-snapshot.sqlite3">
    <comment>Asset Snapshot data file</comment>
    <comment xml:lang="zh-CN">资产快照数据文件</comment>
    <glob pattern="*.asdb"/>
    <magic priority="50">
      <match type="string" value="SQLite format 3" offset="0"/>
    </magic>
  </mime-type>
</mime-info>
"#;

fn user_data_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
        .map(|h| h.join(".local").join("share"))
}

/// Register the .asdb MIME type in the user's local MIME database.
/// This ensures the app appears in "Open With" menus for .asdb files
/// even when installed via AppImage (which lacks install scripts).
pub fn register_mime_type() {
    let Some(data_dir) = user_data_dir() else {
        return;
    };

    let mime_packages = data_dir.join("mime").join("packages");
    let xml_path = mime_packages.join("asset-snapshot.xml");

    // Skip if already registered
    if xml_path.exists() {
        return;
    }

    // Create directory and write MIME XML
    if std::fs::create_dir_all(&mime_packages).is_err() {
        return;
    }
    if std::fs::write(&xml_path, MIME_XML).is_err() {
        return;
    }

    // Update MIME database so the type is recognized
    let mime_dir = data_dir.join("mime");
    let _ = Command::new("update-mime-database")
        .arg(&mime_dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();

    // Update desktop database so file managers show the app
    let app_dir = data_dir.join("applications");
    let _ = Command::new("update-desktop-database")
        .arg(&app_dir)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}
