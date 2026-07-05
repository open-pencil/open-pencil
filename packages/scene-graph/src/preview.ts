import type { SceneNode } from './types'
import { normalizeVectorNetwork } from './vector-network'

type PreviewGraph = {
  nodes: Map<string, SceneNode>
  positionPreviewVersion: number
  clearAbsPosCache: () => void
}

const LAYOUT_AFFECTING_KEYS = new Set<string>([
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'parentId',
  'childIds',
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'layoutGrow',
  'layoutAlignSelf',
  'layoutPositioning',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'visible',
  'text',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'styleRuns',
  'textAutoResize'
])

const TEXT_PICTURE_KEYS = new Set<string>([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textAlignHorizontal',
  'textDirection',
  'textAlignVertical',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textCase',
  'styleRuns',
  'fills',
  'width',
  'height'
])

const GLYPH_AFFECTING_KEYS = new Set<string>([
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'styleRuns'
])

export function updateNodePreview(
  graph: PreviewGraph,
  id: string,
  changes: Partial<SceneNode>
): Partial<SceneNode> | null {
  const node = graph.nodes.get(id)
  if (!node) return null
  if ((Object.keys(changes) as (keyof SceneNode)[]).every((key) => node[key] === changes[key])) {
    return null
  }
  const affectsLayout = Object.keys(changes).some((key) => LAYOUT_AFFECTING_KEYS.has(key))
  if (affectsLayout) graph.clearAbsPosCache()
  if (node.type === 'TEXT') {
    const textChanged = Object.keys(changes).some((key) => TEXT_PICTURE_KEYS.has(key))
    if (node.textPicture && textChanged) node.textPicture = null
    const glyphChanged = Object.keys(changes).some((key) => GLYPH_AFFECTING_KEYS.has(key))
    if (node.figmaDerivedTextGlyphs && glyphChanged) node.figmaDerivedTextGlyphs = null
  }
  const normalizedChanges = changes.vectorNetwork
    ? { ...changes, vectorNetwork: normalizeVectorNetwork(changes.vectorNetwork) }
    : changes
  graph.positionPreviewVersion++
  Object.assign(node, normalizedChanges)
  return normalizedChanges
}
