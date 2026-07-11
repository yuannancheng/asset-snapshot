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

/// Icon name derived from MIME type: replace '/' with '-'
const MIME_ICON_NAME: &str = "application-vnd.asset-snapshot.sqlite3";

/// Embedded icon files for MIME type association
const ICON_SVG: &[u8] = include_bytes!("../icons/asdb-file-icon.svg");
const ICON_16: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-16x16.png");
const ICON_24: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-24x24.png");
const ICON_32: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-32x32.png");
const ICON_48: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-48x48.png");
const ICON_64: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-64x64.png");
const ICON_128: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-128x128.png");
const ICON_256: &[u8] = include_bytes!("../icons/filetype/asdb-file-icon-256x256.png");

fn user_data_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .ok()
        .map(PathBuf::from)
        .map(|h| h.join(".local").join("share"))
}

fn try_run<S: AsRef<std::ffi::OsStr>>(cmd: &str, args: &[S]) {
    let _ = Command::new(cmd)
        .args(args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// Register the .asdb MIME type and install icon files in the user's local
/// data directory.  The MIME XML is written first, then per-size PNG icons
/// and a scalable SVG are placed under the user's hicolor icon tree, and
/// finally the MIME, desktop, and icon caches are updated so that file
/// managers immediately pick up the association and icon.
pub fn register_mime_type() {
    let Some(data_dir) = user_data_dir() else {
        return;
    };

    // --- MIME XML registration ---
    let mime_xml_dir = data_dir.join("mime").join("packages");
    let xml_path = mime_xml_dir.join("asset-snapshot.xml");

    if !xml_path.exists() {
        if std::fs::create_dir_all(&mime_xml_dir).is_err() {
            return;
        }
        if std::fs::write(&xml_path, MIME_XML).is_err() {
            return;
        }
    }

    // --- Icon installation ---
    let icons_base = data_dir.join("icons").join("hicolor");
    let icon_entries: &[(&str, &[u8])] = &[
        ("scalable/mimetypes", ICON_SVG),
        ("16x16/mimetypes", ICON_16),
        ("24x24/mimetypes", ICON_24),
        ("32x32/mimetypes", ICON_32),
        ("48x48/mimetypes", ICON_48),
        ("64x64/mimetypes", ICON_64),
        ("128x128/mimetypes", ICON_128),
        ("256x256/mimetypes", ICON_256),
    ];

    let need_icon_update = icon_entries.iter().any(|(dir, _)| {
        let file_name = if dir.starts_with("scalable") {
            format!("{}.svg", MIME_ICON_NAME)
        } else {
            format!("{}.png", MIME_ICON_NAME)
        };
        !icons_base.join(dir).join(&file_name).exists()
    });

    if need_icon_update {
        for (dir, data) in icon_entries {
            let dest_dir = icons_base.join(dir);
            let file_name = if dir.starts_with("scalable") {
                format!("{}.svg", MIME_ICON_NAME)
            } else {
                format!("{}.png", MIME_ICON_NAME)
            };
            let dest = dest_dir.join(&file_name);
            if dest.exists() {
                continue;
            }
            if std::fs::create_dir_all(&dest_dir).is_err() {
                continue;
            }
            let _ = std::fs::write(&dest, data);
        }
    }

    // --- Yaru icon installation (Ubuntu Nautilus hicolor fallback broken, gnome #3341) ---
    {
        let yaru_base = data_dir.join("icons").join("Yaru");
        let need_yaru_update = icon_entries.iter().any(|(dir, _)| {
            let file_name = if dir.starts_with("scalable") {
                format!("{}.svg", MIME_ICON_NAME)
            } else {
                format!("{}.png", MIME_ICON_NAME)
            };
            !yaru_base.join(dir).join(&file_name).exists()
        });

        if need_yaru_update {
            for (dir, data) in icon_entries {
                let dest_dir = yaru_base.join(dir);
                let file_name = if dir.starts_with("scalable") {
                    format!("{}.svg", MIME_ICON_NAME)
                } else {
                    format!("{}.png", MIME_ICON_NAME)
                };
                let dest = dest_dir.join(&file_name);
                if !dest.exists() {
                    if std::fs::create_dir_all(&dest_dir).is_ok() {
                        let _ = std::fs::write(&dest, data);
                    }
                }
            }
        }
        try_run("gtk-update-icon-cache", &[yaru_base.as_path()]);
        try_run("gtk4-update-icon-cache", &[yaru_base.as_path()]);
    }
    // --- Cache updates ---
    try_run("update-mime-database", &[data_dir.join("mime").as_path()]);
    try_run(
        "update-desktop-database",
        &[data_dir.join("applications").as_path()],
    );
    try_run("gtk-update-icon-cache", &[icons_base.as_path()]);
    try_run("gtk4-update-icon-cache", &[icons_base.as_path()]);
}
