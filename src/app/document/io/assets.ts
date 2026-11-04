import { dirname, join, resolve, sep } from '@tauri-apps/api/path'
import { lstat, readFile } from '@tauri-apps/plugin-fs'

import { IS_TAURI } from '@open-pencil/core/constants'
import type { ReadDocumentInput } from '@open-pencil/core/io'

/**
 * Reads the files a document opened from `path` names relative to itself, such as a `.pen`
 * document's images, from the document's folder only. A browser has no path to read beside, so
 * documents opened there get none. A path that leaves the folder, through `..` or a link, reads
 * nothing.
 */
export function documentAssetReader(path: string | undefined): ReadDocumentInput['readAsset'] {
  if (!IS_TAURI || !path) return undefined
  return async (relative) => {
    const folder = await dirname(path)
    const target = await resolve(folder, relative)
    if (!target.startsWith(folder + sep())) return null
    // A link inside the folder could still lead out of it, so no step of the path may be one.
    let step = folder
    for (const part of target.slice(folder.length + 1).split(sep())) {
      step = await join(step, part)
      const info = await lstat(step).catch(() => null)
      if (!info || info.isSymlink) return null
    }
    return readFile(target).catch(() => null)
  }
}
