import {
  cloneVectorNetwork,
  scaleGeometryPaths,
  type Effect,
  type Fill,
  type GridTrack,
  type LayoutGrid,
  type SceneGraph,
  type SceneNode,
  type Stroke,
  type StyleRun
} from '@open-pencil/scene-graph'

const MIN_SCALE = 0.01
const RESCALABLE_NODE_TYPES = new Set<SceneNode['type']>([
  'BOOLEAN_OPERATION',
  'COMPONENT',
  'COMPONENT_SET',
  'ELLIPSE',
  'FRAME',
  'GROUP',
  'INSTANCE',
  'LINE',
  'POLYGON',
  'RECTANGLE',
  'STAR',
  'TEXT',
  'VECTOR'
])

function scaledOptional(value: number | null, scale: number): number | null {
  return value == null ? null : value * scale
}

function scaledStrokes(strokes: readonly Stroke[], scale: number): Stroke[] {
  return strokes.map((stroke) => ({
    ...structuredClone(stroke),
    weight: stroke.weight * scale,
    dashPattern: stroke.dashPattern?.map((value) => value * scale)
  }))
}

function scaledEffects(effects: readonly Effect[], scale: number): Effect[] {
  return effects.map((effect) => ({
    ...structuredClone(effect),
    offset: { x: effect.offset.x * scale, y: effect.offset.y * scale },
    radius: effect.radius * scale,
    spread: effect.spread * scale
  }))
}

function scaledFills(fills: readonly Fill[], scale: number): Fill[] {
  return fills.map((fill) => ({
    ...structuredClone(fill),
    scale: fill.scale == null ? undefined : fill.scale * scale,
    spacing: fill.spacing == null ? undefined : fill.spacing * scale,
    patternSpacing: fill.patternSpacing
      ? { x: fill.patternSpacing.x * scale, y: fill.patternSpacing.y * scale }
      : undefined,
    noiseSize: fill.noiseSize
      ? { x: fill.noiseSize.x * scale, y: fill.noiseSize.y * scale }
      : undefined
  }))
}

function scaledStyleRuns(styleRuns: readonly StyleRun[], scale: number): StyleRun[] {
  return styleRuns.map((run) => ({
    ...structuredClone(run),
    style: {
      ...structuredClone(run.style),
      fontSize: run.style.fontSize == null ? undefined : run.style.fontSize * scale,
      letterSpacing: run.style.letterSpacing == null ? undefined : run.style.letterSpacing * scale,
      lineHeight: scaledOptional(run.style.lineHeight ?? null, scale),
      textDecorationThickness: scaledOptional(run.style.textDecorationThickness ?? null, scale),
      textUnderlineOffset: scaledOptional(run.style.textUnderlineOffset ?? null, scale)
    }
  }))
}

function scaledLayoutGrids(grids: readonly LayoutGrid[], scale: number): LayoutGrid[] {
  return grids.map((grid) => ({
    ...structuredClone(grid),
    offset: grid.offset == null ? undefined : grid.offset * scale,
    sectionSize: grid.sectionSize == null ? undefined : grid.sectionSize * scale,
    gutterSize: grid.gutterSize == null ? undefined : grid.gutterSize * scale
  }))
}

function scaledGridTracks(tracks: readonly GridTrack[], scale: number): GridTrack[] {
  return tracks.map((track) => ({
    ...track,
    value: track.sizing === 'FIXED' ? track.value * scale : track.value
  }))
}

function scaledVectorNetwork(node: SceneNode, scale: number): SceneNode['vectorNetwork'] {
  if (!node.vectorNetwork) return null
  const network = cloneVectorNetwork(node.vectorNetwork)
  for (const vertex of network.vertices) {
    vertex.x *= scale
    vertex.y *= scale
  }
  for (const segment of network.segments) {
    segment.tangentStart.x *= scale
    segment.tangentStart.y *= scale
    segment.tangentEnd.x *= scale
    segment.tangentEnd.y *= scale
  }
  return network
}

function scaleNodeChanges(
  node: SceneNode,
  scale: number,
  scalePosition: boolean
): Partial<SceneNode> {
  return {
    x: scalePosition ? node.x * scale : node.x,
    y: scalePosition ? node.y * scale : node.y,
    width: node.width * scale,
    height: node.height * scale,
    minWidth: scaledOptional(node.minWidth, scale),
    maxWidth: scaledOptional(node.maxWidth, scale),
    minHeight: scaledOptional(node.minHeight, scale),
    maxHeight: scaledOptional(node.maxHeight, scale),
    cornerRadius: node.cornerRadius * scale,
    topLeftRadius: node.topLeftRadius * scale,
    topRightRadius: node.topRightRadius * scale,
    bottomRightRadius: node.bottomRightRadius * scale,
    bottomLeftRadius: node.bottomLeftRadius * scale,
    fontSize: node.fontSize * scale,
    letterSpacing: node.letterSpacing * scale,
    lineHeight: scaledOptional(node.lineHeight, scale),
    textDecorationThickness: scaledOptional(node.textDecorationThickness, scale),
    textUnderlineOffset: scaledOptional(node.textUnderlineOffset, scale),
    styleRuns: scaledStyleRuns(node.styleRuns, scale),
    itemSpacing: node.itemSpacing * scale,
    counterAxisSpacing: node.counterAxisSpacing * scale,
    paddingTop: node.paddingTop * scale,
    paddingRight: node.paddingRight * scale,
    paddingBottom: node.paddingBottom * scale,
    paddingLeft: node.paddingLeft * scale,
    gridColumnGap: node.gridColumnGap * scale,
    gridRowGap: node.gridRowGap * scale,
    gridTemplateColumns: scaledGridTracks(node.gridTemplateColumns, scale),
    gridTemplateRows: scaledGridTracks(node.gridTemplateRows, scale),
    strokes: scaledStrokes(node.strokes, scale),
    dashPattern: node.dashPattern.map((value) => value * scale),
    borderTopWeight: node.borderTopWeight * scale,
    borderRightWeight: node.borderRightWeight * scale,
    borderBottomWeight: node.borderBottomWeight * scale,
    borderLeftWeight: node.borderLeftWeight * scale,
    strokeMiterLimit: node.strokeMiterLimit,
    effects: scaledEffects(node.effects, scale),
    fills: scaledFills(node.fills, scale),
    layoutGrids: scaledLayoutGrids(node.layoutGrids, scale),
    vectorNetwork: scaledVectorNetwork(node, scale),
    fillGeometry: scaleGeometryPaths(node.fillGeometry, scale, scale),
    strokeGeometry: scaleGeometryPaths(node.strokeGeometry, scale, scale)
  }
}

/** Scale a node tree from the root node's top-left, matching Figma's Scale tool. */
export function rescaleNodeTree(graph: SceneGraph, rootId: string, scale: number): void {
  if (!Number.isFinite(scale)) throw new TypeError('Scale must be a finite number')
  if (scale < MIN_SCALE) throw new RangeError(`Scale must be at least ${MIN_SCALE}`)

  const root = graph.getNode(rootId)
  if (!root || !RESCALABLE_NODE_TYPES.has(root.type)) {
    throw new Error('rescale() is not supported on this node')
  }

  const nodes: SceneNode[] = [root]
  const collect = (node: SceneNode): void => {
    for (const childId of node.childIds) {
      const child = graph.getNode(childId)
      if (!child) continue
      nodes.push(child)
      collect(child)
    }
  }
  collect(root)

  for (const node of nodes) {
    graph.updateNode(node.id, scaleNodeChanges(node, scale, node.id !== rootId))
  }
}
