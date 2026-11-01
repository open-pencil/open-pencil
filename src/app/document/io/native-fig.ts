import { invoke } from '@tauri-apps/api/core'

import { setFigArchiveAssembler } from '@open-pencil/core/io/formats/fig'

/**
 * The desktop app packs every `.fig` it writes in Rust, on a blocking thread, since high
 * compression levels take seconds (`build_fig_file`, `desktop/AGENTS.md`).
 */
export function installNativeFigArchives(): void {
  setFigArchiveAssembler(
    async (parts) =>
      new Uint8Array(
        await invoke<ArrayBuffer>('build_fig_file', {
          file: {
            schemaDeflated: Array.from(parts.schemaDeflated),
            kiwiData: Array.from(parts.kiwiData),
            thumbnailPng: Array.from(parts.thumbnailPNG),
            metaJson: parts.metaJSON,
            images: parts.images.map((image) => ({
              name: image.name,
              data: Array.from(image.data)
            })),
            figKiwiVersion: parts.figKiwiVersion,
            compressionLevel: parts.compressionLevel,
            board: parts.documentKind === 'board'
          }
        })
      )
  )
}
