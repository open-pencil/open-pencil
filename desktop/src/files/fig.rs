use serde::Deserialize;
use std::io::{Cursor, Write};

#[derive(Deserialize)]
pub struct ImageEntry {
    name: String,
    data: Vec<u8>,
}

/// The zstd level Figma itself saves with.
const DEFAULT_COMPRESSION_LEVEL: i32 = 3;

/// Writes the `.fig` archive on a blocking thread: high zstd levels take seconds on large
/// documents, which would otherwise stall the window.
#[tauri::command]
pub async fn build_fig_file(
    schema_deflated: Vec<u8>,
    kiwi_data: Vec<u8>,
    thumbnail_png: Vec<u8>,
    meta_json: String,
    images: Option<Vec<ImageEntry>>,
    fig_kiwi_version: Option<u32>,
    compression_level: Option<i32>,
) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        write_fig_file(
            schema_deflated,
            kiwi_data,
            thumbnail_png,
            meta_json,
            images,
            fig_kiwi_version,
            compression_level,
        )
    })
    .await
    .map_err(|e| e.to_string())?
}

fn write_fig_file(
    schema_deflated: Vec<u8>,
    kiwi_data: Vec<u8>,
    thumbnail_png: Vec<u8>,
    meta_json: String,
    images: Option<Vec<ImageEntry>>,
    fig_kiwi_version: Option<u32>,
    compression_level: Option<i32>,
) -> Result<tauri::ipc::Response, String> {
    let levels = zstd::compression_level_range();
    let level = compression_level
        .unwrap_or(DEFAULT_COMPRESSION_LEVEL)
        .clamp(*levels.start(), *levels.end());
    // Figma rejects zstd frames that do not declare their decompressed size.
    let mut encoder = zstd::Encoder::new(Vec::new(), level).map_err(|e| e.to_string())?;
    encoder
        .include_contentsize(true)
        .map_err(|e| e.to_string())?;
    encoder
        .set_pledged_src_size(Some(kiwi_data.len() as u64))
        .map_err(|e| e.to_string())?;
    encoder.write_all(&kiwi_data).map_err(|e| e.to_string())?;
    let zstd_data = encoder.finish().map_err(|e| e.to_string())?;

    let version: u32 = fig_kiwi_version.unwrap_or(101);
    let fig_kiwi_len = 8 + 4 + 4 + schema_deflated.len() + 4 + zstd_data.len();
    let mut fig_kiwi = Vec::with_capacity(fig_kiwi_len);
    fig_kiwi.extend_from_slice(b"fig-kiwi");
    fig_kiwi.extend_from_slice(&version.to_le_bytes());
    fig_kiwi.extend_from_slice(&(schema_deflated.len() as u32).to_le_bytes());
    fig_kiwi.extend_from_slice(&schema_deflated);
    fig_kiwi.extend_from_slice(&(zstd_data.len() as u32).to_le_bytes());
    fig_kiwi.extend_from_slice(&zstd_data);

    let buf = Cursor::new(Vec::new());
    let mut zip = zip::ZipWriter::new(buf);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("canvas.fig", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&fig_kiwi).map_err(|e| e.to_string())?;

    zip.start_file("thumbnail.png", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(&thumbnail_png).map_err(|e| e.to_string())?;

    zip.start_file("meta.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(meta_json.as_bytes())
        .map_err(|e| e.to_string())?;

    if let Some(image_entries) = images {
        for entry in image_entries {
            zip.start_file(&entry.name, options)
                .map_err(|e| e.to_string())?;
            zip.write_all(&entry.data).map_err(|e| e.to_string())?;
        }
    }

    let result = zip.finish().map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(result.into_inner()))
}
