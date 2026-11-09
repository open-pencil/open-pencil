import { invoke } from '@tauri-apps/api/core'

import { setFigCanvasCompressor } from '@open-pencil/core/io/formats/fig'

/**
 * The desktop app compresses a save's document data in Rust, on a blocking thread, since high
 * compression levels take seconds (`compress_fig_canvas`, `desktop/AGENTS.md`). Only the schema
 * and the encoded document cross IPC; the images are streamed into the archive from the webview.
 */
export function installNativeFigArchives(): void {
  setFigCanvasCompressor(async (parts) => {
    const body = new Uint8Array(parts.schemaDeflated.byteLength + parts.kiwiData.byteLength)
    body.set(parts.schemaDeflated)
    body.set(parts.kiwiData, parts.schemaDeflated.byteLength)
    const bytes = await invoke<ArrayBuffer>('compress_fig_canvas', body, {
      headers: {
        'x-fig-schema-length': String(parts.schemaDeflated.byteLength),
        'x-fig-version': String(parts.figKiwiVersion ?? 0),
        'x-fig-compression-level':
          parts.compressionLevel === undefined ? '' : String(parts.compressionLevel),
        'x-fig-board': parts.documentKind === 'board' ? '1' : '0'
      }
    })
    return new Uint8Array(bytes)
  })
}
