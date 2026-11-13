import { invoke } from '@tauri-apps/api/core'

import { setFigCanvasCompressor } from '@open-pencil/core/io/formats/fig'

/**
 * The desktop app compresses a save's document data in Rust, on a blocking thread, since high
 * compression levels take seconds (`compress_fig_canvas`, `desktop/AGENTS.md`). The schema and
 * the encoded document travel as one raw body; the images stay in the webview, which writes the
 * archive around the compressed data.
 */
export function installNativeFigArchives(): void {
  setFigCanvasCompressor(async (parts) => {
    const body = new Uint8Array(parts.schemaDeflated.byteLength + parts.kiwiData.byteLength)
    body.set(parts.schemaDeflated)
    body.set(parts.kiwiData, parts.schemaDeflated.byteLength)
    const headers: Record<string, string> = {
      'x-fig-schema-length': String(parts.schemaDeflated.byteLength),
      'x-fig-board': String(parts.kind === 'board')
    }
    if (parts.figKiwiVersion !== undefined) headers['x-fig-version'] = String(parts.figKiwiVersion)
    if (parts.compressionLevel !== undefined) {
      headers['x-fig-compression-level'] = String(parts.compressionLevel)
    }
    return new Uint8Array(await invoke<ArrayBuffer>('compress_fig_canvas', body, { headers }))
  })
}
