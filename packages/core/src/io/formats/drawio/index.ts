export { buildDrawioGraph } from './build'
export { parseDrawioFile, type DrawioFile } from './document'
export { drawioSource, isDrawioExportFileName } from './embedded'

import type { SceneGraph } from '@open-pencil/scene-graph'

import { buildDrawioGraph } from './build'
import { parseDrawioFile } from './document'

/**
 * A draw.io file as a document, or null when it is not a draw.io file. A file with a page that
 * cannot be read (damaged, or larger than the size limit once unpacked) is an error naming those
 * pages, never a document with pages missing.
 */
export function readDrawioDocument(source: string): SceneGraph | null {
  const file = parseDrawioFile(source)
  if (!file) return null
  if (file.unreadable.length > 0) {
    throw new Error(`Could not read these draw.io pages: ${file.unreadable.join(', ')}`)
  }
  return buildDrawioGraph(file.pages)
}
