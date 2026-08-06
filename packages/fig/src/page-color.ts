import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

/**
 * The stage colour lives on the page's imported Figma fields.
 *
 * It is stored there rather than in editor state because that is the field
 * `fig/export.ts` already writes to the file. Editor state is per-session: a
 * stage colour kept only there was lost on save and reset to the default on
 * open, so a red canvas came back grey and then overwrote itself.
 */
const FIELD = 'backgroundColor'

function isColor(value: unknown): value is Color {
  return (
    value !== null &&
    typeof value === 'object' &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    typeof value.r === 'number' &&
    typeof value.g === 'number' &&
    typeof value.b === 'number'
  )
}

export function readStoredPageColor(graph: SceneGraph, pageId: string): Color | null {
  const fields = graph.getNode(pageId)?.source.fig.rawNodeFields
  const stored = fields?.[FIELD]
  // Alpha is not part of the stored value in every file, and a transparent
  // stage is not a state the canvas can render — treat it as fully opaque.
  return isColor(stored) ? { r: stored.r, g: stored.g, b: stored.b, a: 1 } : null
}

export function writeStoredPageColor(graph: SceneGraph, pageId: string, color: Color): void {
  const page = graph.getNode(pageId)
  const fig = page?.source.fig
  if (!fig) return
  fig.rawNodeFields[FIELD] = { r: color.r, g: color.g, b: color.b, a: 1 }
}
