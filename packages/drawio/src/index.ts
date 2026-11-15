import { drawioRoot } from './embedded'
import { inflateBudget } from './inflate'
import type { DrawIOFile } from './model'
import { readDrawIORoot } from './read'

export { isDrawIOExportFileName } from './embedded'
export { MAX_INFLATED_BYTES } from './inflate'
export type {
  DrawIOCell,
  DrawIOFile,
  DrawIOGeometry,
  DrawIOLayer,
  DrawIOPage,
  DrawIOPoint,
  DrawIOStyle
} from './model'
export { parseDrawIOFile } from './read'
export { formatStyle, parseStyle, styleFlag, styleNumber } from './style'
export { writeDrawIOFile } from './write'

/**
 * The draw.io file in `bytes`: a `.drawio` or `.dio` file, or the diagram a draw.io PNG or SVG
 * export embeds. Null when the bytes hold no draw.io diagram. Everything the file unpacks, its
 * compressed pages and image chunks together, shares one size limit.
 */
export function readDrawIOBytes(bytes: Uint8Array): DrawIOFile | null {
  const budget = inflateBudget()
  const root = drawioRoot(bytes, budget)
  return root ? readDrawIORoot(root, budget) : null
}
