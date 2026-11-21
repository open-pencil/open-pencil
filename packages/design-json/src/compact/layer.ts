import { describeStyle, firstSolidColor } from '#design-json/compact/style'
import type {
  CompactKind,
  CompactLayout,
  CompactNode,
  CompactText
} from '#design-json/compact/types'
import { describeVector } from '#design-json/compact/vector'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** A compact layer before its box is made relative to its parent and its children are added. */
export type CompactLayer = Omit<CompactNode, 'box' | 'children'>

const KINDS: Partial<Record<SceneNode['type'], CompactKind>> = {
  FRAME: 'frame',
  SECTION: 'section',
  GROUP: 'group',
  COMPONENT: 'component',
  COMPONENT_SET: 'component',
  INSTANCE: 'instance',
  TEXT: 'text',
  RECTANGLE: 'shape',
  ROUNDED_RECTANGLE: 'shape',
  ELLIPSE: 'shape',
  SHAPE_WITH_TEXT: 'shape',
  STICKY: 'shape',
  VECTOR: 'vector',
  LINE: 'vector',
  STAR: 'vector',
  POLYGON: 'vector',
  BOOLEAN_OPERATION: 'vector',
  CONNECTOR: 'vector'
}

/**
 * TODO: Decide what the compact view keeps of each layer. This first cut keeps what rendering it
 * needs: what it is, its auto layout, how it looks, its text, a vector's paths, its images, and
 * the component an instance shows. Review each field against what the generated code actually uses, and drop what
 * it never reads.
 */
export function compactLayer(graph: SceneGraph, node: SceneNode): CompactLayer {
  const images = imageHashes(node)
  const kind = compactKind(node, images)
  return {
    id: node.id,
    name: node.name,
    kind,
    layout: describeLayout(node),
    // A text's fills are its color, and an image's are the image.
    style: describeStyle(node, kind !== 'text' && kind !== 'image'),
    text: describeText(node),
    vector: kind === 'vector' ? describeVector(node) : undefined,
    images: images.length > 0 ? images : undefined,
    component: describeComponent(graph, node)
  }
}

/** A shape whose fills draw an image is an image; otherwise the kind follows the layer type. */
function compactKind(node: SceneNode, images: readonly string[]): CompactKind {
  const kind = KINDS[node.type] ?? 'other'
  if (kind === 'shape' && images.length > 0) return 'image'
  return kind
}

function imageHashes(node: SceneNode): string[] {
  return node.fills.flatMap((fill) => {
    if (!fill.visible || fill.type !== 'IMAGE' || !fill.imageHash) return []
    return [fill.imageHash]
  })
}

const DIRECTIONS = { HORIZONTAL: 'row', VERTICAL: 'column', GRID: 'grid' } as const

function describeLayout(node: SceneNode): CompactLayout | undefined {
  if (node.layoutMode === 'NONE') return undefined
  return {
    direction: DIRECTIONS[node.layoutMode],
    gap: node.itemSpacing,
    padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
    align: node.primaryAxisAlign,
    crossAlign: node.counterAxisAlign,
    wrap: node.layoutWrap === 'WRAP'
  }
}

function describeText(node: SceneNode): CompactText | undefined {
  if (node.type !== 'TEXT') return undefined
  return {
    content: node.text,
    font: {
      family: node.fontFamily,
      size: node.fontSize,
      weight: node.fontWeight,
      italic: node.italic
    },
    color: firstSolidColor(node.fills),
    align: node.textAlignHorizontal
  }
}

function describeComponent(graph: SceneGraph, node: SceneNode): CompactNode['component'] {
  if (node.type !== 'INSTANCE' || !node.componentId) return undefined
  const main = graph.getNode(node.componentId)
  if (!main) return undefined
  return { id: main.id, name: main.name, props: node.componentPropertyValues }
}
