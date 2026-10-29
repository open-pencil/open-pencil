import type { SceneGraph } from '../graph'
import type { Rect, Vector } from '../primitives'
import type { Fill, SceneNode } from '../types'

/** Where a pattern's source repeats in one tile: the tile, the source's scale, and its copies. */
export interface PatternTileLayout {
  rect: Rect
  scale: number
  positions: Vector[]
}

function patternAlignmentOffset(
  alignment: Fill['horizontalAlignment'],
  gap: number,
  sourceSize: number,
  axis: 'x' | 'y'
): number {
  if (alignment === 'CENTER') return axis === 'x' ? -gap / 2 : -sourceSize / 2
  if (alignment === 'END') return -gap
  return 0
}

export function patternTileLayout(
  source: Pick<SceneNode, 'width' | 'height'>,
  fill: Fill
): PatternTileLayout {
  const scale = fill.scale && fill.scale > 0 ? fill.scale : 1
  const spacing = fill.patternSpacing ?? { x: 0, y: 0 }
  const scaledWidth = source.width * scale
  const scaledHeight = source.height * scale
  const gapX = scaledWidth * spacing.x
  const gapY = scaledHeight * spacing.y
  const width = scaledWidth + gapX
  const height = scaledHeight + gapY
  const x = patternAlignmentOffset(fill.horizontalAlignment, gapX, scaledWidth, 'x')
  const y = patternAlignmentOffset(fill.verticalAlignment, gapY, scaledHeight, 'y')
  const positions = [{ x, y }]

  if (fill.patternTileType === 'HORIZONTAL_HEXAGONAL') {
    positions.push({ x: x + width / 2, y: y + height / 2 })
  } else if (fill.patternTileType === 'VERTICAL_HEXAGONAL') {
    positions.push({ x: x + width / 2, y: y - height / 2 })
  }

  return { rect: { x: 0, y: 0, width, height }, scale, positions }
}

function addPatternSourceIds(paints: readonly Fill[], ids: string[]) {
  for (const paint of paints) {
    if (paint.type === 'PATTERN' && paint.sourceNodeId) {
      ids.push(paint.sourceNodeId)
    }
  }
}

function patternSourceIds(node: SceneNode): string[] {
  const ids: string[] = []
  addPatternSourceIds(node.fills, ids)
  addPatternSourceIds(node.strokes, ids)
  for (const region of node.vectorNetwork?.regions ?? []) {
    addPatternSourceIds(region.fills ?? [], ids)
  }
  return ids
}

function indexBySourceId(graph: SceneGraph): Map<string, SceneNode> {
  const index = new Map<string, SceneNode>()
  for (const node of graph.getAllNodes()) {
    if (node.source.id && !index.has(node.source.id)) {
      index.set(node.source.id, node)
    }
  }
  return index
}

export function createPatternSourceLookup(
  graph: SceneGraph
): (sourceId: string) => SceneNode | null {
  let bySourceId: Map<string, SceneNode> | null = null
  return (sourceId) => {
    const direct = graph.getNode(sourceId)
    if (direct) {
      return direct
    }
    bySourceId ??= indexBySourceId(graph)
    return bySourceId.get(sourceId) ?? null
  }
}

export function resolvedPatternSourceIds(
  node: SceneNode,
  findSource: (sourceId: string) => SceneNode | null
): string[] {
  return patternSourceIds(node).flatMap((sourceId) => findSource(sourceId)?.id ?? [])
}
