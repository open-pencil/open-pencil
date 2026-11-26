import { invoke } from '@tauri-apps/api/core'

import { IS_TAURI } from '@open-pencil/core/constants'
import type { ReadDocumentInput } from '@open-pencil/core/io'

/**
 * Reads the files a document opened from `path` names relative to itself, such as a `.pen`
 * document's images, through the desktop app, which reads only images, fonts, and stylesheets in
 * the document's own folder, passing no link or hidden name, and the `.pen` documents it imports
 * (`read_document_asset`). A browser
 * has no path to read beside, so documents opened there get none.
 */
export function documentAssetReader(path: string | undefined): ReadDocumentInput['readAsset'] {
  if (!IS_TAURI || !path) return undefined
  return async (relative) => {
    const bytes = await invoke<ArrayBuffer>('read_document_asset', {
      document: path,
      relative
    }).catch(() => null)
    // No bytes is an asset the app would not read, or one that is not there.
    return bytes && bytes.byteLength > 0 ? new Uint8Array(bytes) : null
  }
}
