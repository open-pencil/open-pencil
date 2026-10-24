import type {
  AxisSizingMode,
  LayoutMode,
  LayoutSizing,
  NodeType,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { fillSizingFields } from '@open-pencil/scene-graph/layout'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { iconName, iconOptions } from './assets'
import { convertEffects } from './effects'
import { ellipseArc, pathNetwork } from './geometry'
import type { PenImages } from './images'
import {
  applyCornerRadius,
  applyPadding,
  mapAlignItems,
  mapJustifyContent,
  mapLayoutMode,
  parseSize
} from './layout'
import { applyStroke, convertPaints, strokeFields } from './paints'
import { isPlain, type PenPlacement } from './placement'
import type { PenNode, PenOverride } from './schema'
import { applyTextProps } from './text'
import {
  bindIfVar,
  resolveBoolean,
  resolveNumber,
  resolveString,
  type VarContext
} from './variables'

/** Where icon glyphs come from, as the host loaded them. */
export interface PenIconSource {
  /**
   * Draws the icon `name` into the frame, `size` square at its origin, painted `color` where the
   * icon takes its colour and drawn with `options` where its set has them. False when the source
   * does not have it.
   */
  draw(
    graph: SceneGraph,
    frameId: string,
    name: string,
    size: number,
    color: Color,
    options?: Record<string, number>
  ): boolean
}

/** What reading one document builds up. */
export interface Build {
  graph: SceneGraph
  ctx: VarContext
  images: PenImages
  icons: PenIconSource | undefined
  /** Reusable nodes by their pen.dev ID. */
  components: Map<string, PenNode>
  /** The pen.dev fields each layer was built from, its instance's and overrides' merged in. */
  effective: Map<string, PenNode>
  /** Instances in reading order, with the `ref` node that made each. */
  instances: Map<string, PenNode>
  /** pen.dev's placement of each turned or mirrored layer, and of every group. */
  placements: Map<string, PenPlacement>
  /** Groups in reading order. */
  groupIds: Set<string>
  /** Frames spreading their children with `space_around`. */
  aroundIds: Set<string>
}

function penPlacement(pen: PenOverride, ctx: VarContext): PenPlacement {
  return {
    x: pen.x ?? 0,
    y: pen.y ?? 0,
    rotation: resolveNumber(pen.rotation, ctx),
    flipX: resolveBoolean(pen.flipX, ctx, false),
    flipY: resolveBoolean(pen.flipY, ctx, false)
  }
}

function sceneType(pen: PenNode): NodeType {
  if (pen.type === 'frame') return pen.reusable ? 'COMPONENT' : 'FRAME'
  if (pen.type === 'rectangle') return 'RECTANGLE'
  if (pen.type === 'ellipse') return 'ELLIPSE'
  if (pen.type === 'polygon') return 'POLYGON'
  if (pen.type === 'group') return 'GROUP'
  if (pen.type === 'text' || pen.type === 'icon_font') return 'TEXT'
  if (pen.type === 'path') return 'VECTOR'
  return 'FRAME'
}

function resolveSizing(pen: PenNode, ctx: VarContext) {
  const isTextLike = pen.type === 'text' || pen.type === 'icon_font'
  const defaultSize = isTextLike ? 20 : 100
  const defaultW = isTextLike && pen.width === undefined ? 0 : defaultSize
  const w = parseSize(pen.width, defaultW, ctx)
  const h = parseSize(pen.height, defaultSize, ctx)
  const layout = mapLayoutMode(pen)

  if (pen.width === undefined && layout !== 'NONE') w.sizing = 'HUG'
  if (pen.height === undefined && layout !== 'NONE') h.sizing = 'HUG'

  return { w, h, layout, isTextLike }
}

function applyAutoLayout(
  node: SceneNode,
  layoutMode: LayoutMode,
  pen: PenNode,
  widthSizing: LayoutSizing,
  heightSizing: LayoutSizing,
  ctx: VarContext
): void {
  node.layoutMode = layoutMode
  node.primaryAxisAlign = mapJustifyContent(pen.justifyContent)
  node.counterAxisAlign = mapAlignItems(pen.alignItems)
  node.itemSpacing = resolveNumber(pen.gap, ctx)
  bindIfVar(node, 'itemSpacing', pen.gap, ctx)
  node.strokesIncludedInLayout = pen.layoutIncludeStroke ?? false

  // Fill is the child's grow or stretch, set with its parent; the frame itself stays fixed.
  const own = (sizing: LayoutSizing): AxisSizingMode => (sizing === 'HUG' ? 'HUG' : 'FIXED')
  if (layoutMode === 'VERTICAL') {
    node.primaryAxisSizing = own(heightSizing)
    node.counterAxisSizing = own(widthSizing)
  } else {
    node.primaryAxisSizing = own(widthSizing)
    node.counterAxisSizing = own(heightSizing)
  }
}

/**
 * Sets every field a layer takes from its pen.dev fields, so a layer copied from a component can be
 * given its overrides by applying its merged fields again. Turned and mirrored layers are built
 * upright and placed once laid out.
 */
// eslint-disable-next-line complexity -- .pen node mapping touches many format-specific fields
export function applyPenProperties(node: SceneNode, pen: PenNode, build: Build): void {
  const { graph, ctx } = build
  const { w, h, layout, isTextLike } = resolveSizing(pen, ctx)
  const hasChildren = (pen.children?.length ?? 0) > 0 || node.childIds.length > 0
  const parentLayout = (node.parentId && graph.getNode(node.parentId)?.layoutMode) || 'NONE'
  // An absolute layer leaves its parent's flow; fill sizing then falls back to its value.
  const absolute = pen.layoutPosition === 'absolute' && parentLayout !== 'NONE'
  const flowLayout = absolute ? 'NONE' : parentLayout

  Object.assign(node, {
    name: pen.name ?? (pen.type === 'icon_font' ? (pen.iconFontName ?? 'Icon') : pen.type),
    x: pen.x ?? 0,
    y: pen.y ?? 0,
    rotation: 0,
    flipX: false,
    flipY: false,
    width: w.value,
    height: h.value,
    minWidth: !hasChildren && w.fitContentFallback !== undefined ? w.fitContentFallback : null,
    minHeight: !hasChildren && h.fitContentFallback !== undefined ? h.fitContentFallback : null,
    visible: resolveBoolean(pen.enabled, ctx),
    opacity: resolveNumber(pen.opacity, ctx, 1),
    clipsContent: resolveBoolean(pen.clip, ctx, false),
    layoutPositioning: absolute ? 'ABSOLUTE' : 'AUTO',
    layoutGrow: 0,
    layoutAlignSelf: 'AUTO',
    boundVariables: {},
    variableModes: pen.theme ? { [ctx.collectionId]: ctx.modeId() } : {}
  } satisfies Partial<SceneNode>)
  bindIfVar(node, 'visible', pen.enabled, ctx)
  bindIfVar(node, 'opacity', pen.opacity, ctx)
  bindIfVar(node, 'width', pen.width, ctx)
  bindIfVar(node, 'height', pen.height, ctx)

  node.layoutMode = 'NONE'
  if (layout !== 'NONE') {
    const widthSizing = flowLayout === 'NONE' && w.sizing === 'FILL' ? 'FIXED' : w.sizing
    const heightSizing = flowLayout === 'NONE' && h.sizing === 'FILL' ? 'FIXED' : h.sizing
    applyAutoLayout(node, layout, pen, widthSizing, heightSizing, ctx)
  }
  if (layout !== 'NONE' && pen.justifyContent === 'space_around') build.aroundIds.add(node.id)
  else build.aroundIds.delete(node.id)

  const placement = penPlacement(pen, ctx)
  if (pen.type === 'group') build.groupIds.add(node.id)
  if (pen.type === 'group' || !isPlain(placement)) build.placements.set(node.id, placement)
  else build.placements.delete(node.id)

  node.fills = convertPaints(pen.fill, 'fills', ctx, node, build.images)
  applyStroke(node, strokeFields(pen), ctx, build.images)
  node.effects = convertEffects(pen.effect, ctx)
  applyCornerRadius(node, pen.cornerRadius, ctx)
  applyPadding(node, pen.padding, ctx)

  // Text without a width resizes to its content, which laying out the document measures.
  if (isTextLike) applyTextProps(node, pen, ctx)

  if (pen.type === 'icon') drawIcon(node, pen, build)
  if (pen.type === 'ellipse') node.arcData = ellipseArc(pen, ctx)
  if (pen.type === 'polygon') node.pointCount = Math.max(3, resolveNumber(pen.polygonCount, ctx, 3))
  if (pen.type === 'path') {
    const network = pathNetwork(pen, node.width, node.height)
    if (network) node.vectorNetwork = network
  }

  if (flowLayout !== 'NONE') {
    if (w.sizing === 'FILL') Object.assign(node, fillSizingFields(flowLayout, 'HORIZONTAL'))
    if (h.sizing === 'FILL') Object.assign(node, fillSizingFields(flowLayout, 'VERTICAL'))
  }
  build.effective.set(node.id, pen)
}

/**
 * An icon draws its glyph in its fill colour, scaled to fit its box and centred, as pen.dev does;
 * an icon the host could not load is an empty frame. Its library, name, and weight may be
 * variables.
 */
function drawIcon(node: SceneNode, pen: PenNode, build: Build): void {
  const { graph, ctx } = build
  const color = node.fills.find((fill) => fill.type === 'SOLID')?.color ?? { ...BLACK }
  node.fills = []
  for (const childId of node.childIds) graph.deleteNode(childId)
  const library = resolveString(pen.library, ctx)
  const icon = resolveString(pen.icon, ctx)
  const size = Math.min(node.width, node.height)
  const name = library && icon ? iconName(library, icon) : null
  if (!library || !name || size <= 0) return
  const weight = pen.weight === undefined ? undefined : resolveNumber(pen.weight, ctx)
  const options = iconOptions(library, weight)
  if (!build.icons?.draw(graph, node.id, name, size, color, options)) return
  const dx = (node.width - size) / 2
  const dy = (node.height - size) / 2
  for (const glyph of graph.getChildren(node.id)) {
    graph.updateNode(glyph.id, { x: glyph.x + dx, y: glyph.y + dy })
  }
}

/**
 * The fields an instance draws with: its component's, with the `ref` node's own replacing them one
 * by one, as pen.dev reads them. A theme on both merges axis by axis.
 */
function instanceFields(ref: PenNode, component: PenNode | undefined): PenNode {
  const { ref: _ref, type: _type, descendants: _descendants, children: _children, ...own } = ref
  if (!component) return { ...own, type: 'frame' }
  const {
    id: _id,
    reusable: _reusable,
    children: _componentChildren,
    descendants: _componentDescendants,
    ...inherited
  } = component
  const theme = component.theme || ref.theme ? { ...component.theme, ...ref.theme } : undefined
  return { ...inherited, ...own, theme, name: ref.name ?? component.name }
}

/** Builds a layer and its children in the layer's theme, merged over its parent's. */
export function createSceneNode(pen: PenNode, parentId: string, build: Build): string | null {
  if (pen.type === 'prompt') return null
  const component = pen.type === 'ref' && pen.ref ? build.components.get(pen.ref) : undefined
  // A component that is not a frame has no instances; its uses are plain copies.
  const instanceOf = pen.type === 'ref' && component?.type === 'frame' ? component : undefined
  const fields = pen.type === 'ref' ? instanceFields(pen, component) : pen
  const leaveTheme = fields.theme ? build.ctx.enterTheme(fields.theme) : undefined
  try {
    const node = build.graph.createNode(instanceOf ? 'INSTANCE' : sceneType(fields), parentId, {
      id: pen.id
    })
    applyPenProperties(node, fields, build)
    if (instanceOf) {
      node.componentId = instanceOf.id
      build.instances.set(node.id, pen)
    } else {
      const children = pen.type === 'ref' ? (component?.children ?? []) : (pen.children ?? [])
      for (const child of children) {
        createSceneNode(
          pen.type === 'ref' ? { ...child, id: `${pen.id}/${child.id}` } : child,
          node.id,
          build
        )
      }
    }
    return node.id
  } finally {
    leaveTheme?.()
  }
}
