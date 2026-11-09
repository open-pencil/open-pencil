use std::io::Write;

use tauri::ipc::{InvokeBody, Request, Response};

/// The zstd level Figma itself saves with.
const DEFAULT_COMPRESSION_LEVEL: i32 = 3;
const DEFAULT_FIG_KIWI_VERSION: u32 = 101;

/// Compresses the document into the `canvas.fig` entry of a save: `schemaDeflated` followed by
/// `kiwiData` arrive as one raw request body, and the header names where the first ends. Images
/// stay in the webview and are streamed into the ZIP there, so they never cross IPC.
#[tauri::command]
pub async fn compress_fig_canvas(request: Request<'_>) -> Result<Response, String> {
    let InvokeBody::Raw(body) = request.body() else {
        return Err("compress_fig_canvas needs a raw request body".into());
    };
    let headers = request.headers();
    let header = |name: &str| headers.get(name).and_then(|value| value.to_str().ok());
    let schema_len: usize = header("x-fig-schema-length")
        .ok_or("missing x-fig-schema-length")?
        .parse()
        .map_err(|_| "invalid x-fig-schema-length")?;
    if schema_len > body.len() {
        return Err("x-fig-schema-length is past the request body".into());
    }
    let version = header("x-fig-version")
        .and_then(|value| value.parse::<u32>().ok())
        .filter(|value| *value != 0)
        .unwrap_or(DEFAULT_FIG_KIWI_VERSION);
    let compression_level =
        header("x-fig-compression-level").and_then(|value| value.parse::<i32>().ok());
    let board = header("x-fig-board") == Some("1");
    let schema_deflated = body[..schema_len].to_vec();
    let kiwi_data = body[schema_len..].to_vec();

    tauri::async_runtime::spawn_blocking(move || {
        write_fig_canvas(
            schema_deflated,
            kiwi_data,
            version,
            compression_level,
            board,
        )
    })
    .await
    .map_err(|error| error.to_string())?
    .map(Response::new)
}

/// The `fig-kiwi` container Figma reads as a design's or board's document data.
fn write_fig_canvas(
    schema_deflated: Vec<u8>,
    kiwi_data: Vec<u8>,
    version: u32,
    compression_level: Option<i32>,
    board: bool,
) -> Result<Vec<u8>, String> {
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

    let fig_kiwi_len = 8 + 4 + 4 + schema_deflated.len() + 4 + zstd_data.len();
    let mut fig_kiwi = Vec::with_capacity(fig_kiwi_len);
    // A FigJam board's `.jam` differs from a design's `.fig` only in this header.
    fig_kiwi.extend_from_slice(if board { b"fig-jam." } else { b"fig-kiwi" });
    fig_kiwi.extend_from_slice(&version.to_le_bytes());
    fig_kiwi.extend_from_slice(&(schema_deflated.len() as u32).to_le_bytes());
    fig_kiwi.extend_from_slice(&schema_deflated);
    fig_kiwi.extend_from_slice(&(zstd_data.len() as u32).to_le_bytes());
    fig_kiwi.extend_from_slice(&zstd_data);
    Ok(fig_kiwi)
}
