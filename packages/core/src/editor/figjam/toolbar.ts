import type { NodeType, SceneNode } from '@open-pencil/scene-graph'

/**
 * Which of FigJam's selection toolbars a selection gets: one per kind of layer, a text toolbar for
 * text with sticky notes, and only arranging for any other mix.
 */
export type FigJamToolbarKind =
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'text'
  | 'section'
  | 'group'
  | 'image'
  | 'layer'
  | 'mixed'

/** Layers FigJam's colour menu paints as plain layers: one colour as fill, and for most a stroke. */
const PLAIN_LAYERS: ReadonlySet<NodeType> = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'POLYGON',
  'STAR',
  'LINE',
  'VECTOR',
  'FRAME',
  'BOOLEAN_OPERATION'
])

const KIND_BY_TYPE: Partial<Record<NodeType, FigJamToolbarKind>> = {
  STICKY: 'sticky',
  SHAPE_WITH_TEXT: 'shape',
  CONNECTOR: 'connector',
  TEXT: 'text',
  SECTION: 'section',
  GROUP: 'group'
}

function layerKind(node: Pick<SceneNode, 'type' | 'fills'>): FigJamToolbarKind {
  if (node.fills.some((fill) => fill.type === 'IMAGE')) return 'image'
  if (PLAIN_LAYERS.has(node.type)) return 'layer'
  return KIND_BY_TYPE[node.type] ?? 'mixed'
}

/** The toolbar FigJam gives a selection, measured in FigJam; `null` for none selected. */
export function figJamToolbarKind(
  layers: readonly Pick<SceneNode, 'type' | 'fills'>[]
): FigJamToolbarKind | null {
  const kinds = new Set(layers.map(layerKind))
  if (kinds.size === 0) return null
  if (kinds.size === 1) return [...kinds][0] ?? null
  // Text and sticky notes share their text menus; any other mix only arranges.
  return [...kinds].every((kind) => kind === 'text' || kind === 'sticky') ? 'text' : 'mixed'
}
