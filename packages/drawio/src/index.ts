import { drawioSource } from './embedded'
import { inflateBudget } from './inflate'
import type { DrawioFile } from './model'
import { parseDrawioFile } from './read'

export { isDrawioExportFileName } from './embedded'
export { MAX_INFLATED_BYTES } from './inflate'
export type {
  DrawioCell,
  DrawioFile,
  DrawioGeometry,
  DrawioLayer,
  DrawioPage,
  DrawioPoint,
  DrawioStyle
} from './model'
export { parseDrawioFile } from './read'
export { formatStyle, parseStyle, styleFlag, styleNumber } from './style'
export { writeDrawioFile } from './write'

/**
 * The draw.io file in `bytes`: a `.drawio` or `.dio` file, or the diagram a draw.io PNG or SVG
 * export embeds. Null when the bytes hold no draw.io diagram. Everything the file unpacks, its
 * compressed pages and image chunks together, shares one size limit.
 */
export function readDrawioBytes(bytes: Uint8Array): DrawioFile | null {
  const budget = inflateBudget()
  const source = drawioSource(bytes, budget)
  return source === null ? null : parseDrawioFile(source, budget)
}
