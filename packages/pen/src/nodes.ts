import type {
  AxisSizingMode,
  LayoutMode,
  LayoutSizing,
  NodeType,
  SceneGraph,
  SceneNode
} from '@open-pencil/scene-graph'
import { CORNER_FIELDS } from '@open-pencil/scene-graph/fields'
import type { FontFamilyStyle } from '@open-pencil/scene-graph/font-style'
import { fillSizingFields } from '@open-pencil/scene-graph/layout'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { convertEffects } from './effects'
import { ellipseArc } from './geometry'
import { drawIcon, insideComponent, useIconComponent } from './icons'
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
import type { NodeFields, PenNode, PenOverride } from './schema'
import { applyTextProps } from './text'
import { bindIfVar, resolveBoolean, resolveNumber, type VarContext } from './variables'

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
  /** The family and style of each font the document bundles, by the name its text gives it. */
  fonts: ReadonlyMap<string, FontFamilyStyle>
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
  /** The components icons in components are instances of, by glyph and size. */
  iconComponents: Map<string, string>
  /** The page those components are on, added with the first one. */
  iconPageId: string | null
  /** Layers whose children an override replaced, whose instances are detached. */
  replaced: Set<string>
  /**
   * The components that are refs whose children each copied layer came through, by the copy's ID,
   * so a copy never takes the children of a component it is already inside.
   */
  refCopyAncestry: Map<string, ReadonlySet<string>>
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
  // pen.dev keeps `gap` between children under `space_between`, as CSS does; auto layout drops it.
  // A hugging frame has no free space to spread, so packing it from the start lays it out the same.
  if (node.primaryAxisAlign === 'SPACE_BETWEEN' && node.primaryAxisSizing === 'HUG') {
    node.primaryAxisAlign = 'MIN'
  }
}

const PLACEMENT_FIELDS = ['x', 'y', 'rotation', 'flipX', 'flipY'] as const

/** What `applyStroke` writes: a stroke's weight and alignment are its paints'. */
const STROKE_WRITES = [
  'strokes',
  'independentStrokeWeights',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'strokeCap',
  'strokeJoin'
] as const

/**
 * The layer fields each property `applyPenProperties` reads writes. A property that writes none of
 * the layer's own fields maps to none: bookkeeping, the decorations pen.dev does not draw, and an
 * icon's glyph, which is the layer's children or the component it shows.
 */
const PROPERTY_FIELDS = {
  name: ['name'],
  context: [],
  x: PLACEMENT_FIELDS,
  y: PLACEMENT_FIELDS,
  width: ['width'],
  height: ['height'],
  reusable: [],
  theme: ['variableModes'],
  enabled: ['visible'],
  opacity: ['opacity'],
  flipX: PLACEMENT_FIELDS,
  flipY: PLACEMENT_FIELDS,
  layoutPosition: ['layoutPositioning'],
  rotation: PLACEMENT_FIELDS,
  fill: ['fills'],
  stroke: STROKE_WRITES,
  strokeWidth: STROKE_WRITES,
  strokeLinecap: ['strokes', 'strokeCap'],
  strokeLinejoin: ['strokes', 'strokeJoin'],
  strokeAlignment: ['strokes'],
  effect: ['effects'],
  cornerRadius: CORNER_FIELDS,
  layout: ['layoutMode'],
  gap: ['itemSpacing'],
  layoutIncludeStroke: ['strokesIncludedInLayout'],
  padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  justifyContent: ['primaryAxisAlign'],
  alignItems: ['counterAxisAlign'],
  clip: ['clipsContent'],
  placeholder: [],
  slot: [],
  innerRadius: ['arcData'],
  startAngle: ['arcData'],
  sweepAngle: ['arcData'],
  polygonCount: ['pointCount'],
  geometry: ['vectorNetwork'],
  fillRule: ['vectorNetwork'],
  viewBox: ['vectorNetwork'],
  content: ['text'],
  textGrowth: ['textAutoResize'],
  fontFamily: ['fontFamily'],
  fontSize: ['fontSize'],
  fontWeight: ['fontWeight'],
  fontStyle: ['italic'],
  letterSpacing: ['letterSpacing'],
  lineHeight: ['lineHeight'],
  textAlign: ['textAlignHorizontal'],
  textAlignVertical: ['textAlignVertical'],
  underline: [],
  strikethrough: [],
  href: [],
  library: [],
  icon: [],
  weight: [],
  iconFontName: [],
  iconFontFamily: [],
  ref: []
} satisfies Record<keyof NodeFields, readonly (keyof SceneNode)[]>

const isProperty = (key: string): key is keyof typeof PROPERTY_FIELDS => key in PROPERTY_FIELDS

/**
 * The fields the properties `pen` carries write, whatever their values: pen.dev keeps a property
 * an instance sets even when it equals its component's, so a later change to the component does
 * not reach it.
 */
export function fieldsSetBy(pen: PenOverride): (keyof SceneNode)[] {
  return Object.keys(pen).flatMap((key) => (isProperty(key) ? PROPERTY_FIELDS[key] : []))
}

function drawIconLayer(node: SceneNode, pen: PenNode, build: Build): void {
  if (node.type === 'INSTANCE') useIconComponent(node, pen, build)
  else drawIcon(node, pen, build)
}

/**
 * Draws a filling or fitting icon again at its laid-out size, which reading it could only guess.
 * Drawing takes the icon's colour from its fill and moves it to the glyph, so the fill is read again.
 */
export function redrawIconAtLaidOutSize(node: SceneNode, pen: PenNode, build: Build): void {
  const { w, h } = resolveSizing(pen, build.ctx)
  if (w.sizing === 'FIXED' && h.sizing === 'FIXED') return
  node.fills = convertPaints(pen.fill, 'fills', build.ctx, node, build.images)
  drawIconLayer(node, pen, build)
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
    variableModes: pen.theme ? ctx.variableModes(pen.theme) : {}
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
  if (isTextLike) applyTextProps(node, pen, ctx, build.fonts)

  if (pen.type === 'icon') drawIconLayer(node, pen, build)
  if (pen.type === 'ellipse') node.arcData = ellipseArc(pen, ctx)
  if (pen.type === 'polygon') node.pointCount = Math.max(3, resolveNumber(pen.polygonCount, ctx, 3))

  if (flowLayout !== 'NONE') {
    if (w.sizing === 'FILL') Object.assign(node, fillSizingFields(flowLayout, 'HORIZONTAL'))
    if (h.sizing === 'FILL') Object.assign(node, fillSizingFields(flowLayout, 'VERTICAL'))
  }
  build.effective.set(node.id, pen)
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

/** How many components that are refs a use resolves through before it stops, so a cycle ends. */
const MAX_REF_COMPONENT_DEPTH = 16

const NO_ANCESTRY: ReadonlySet<string> = new Set()

/**
 * Copies of a component's layers under `prefix`, as a use names the layers it copies, each
 * recorded as having come through `ancestry`.
 */
function copiedLayers(
  layers: readonly PenNode[],
  prefix: string,
  ancestry: ReadonlySet<string>,
  build: Build
): PenNode[] {
  return layers.map((layer) => {
    const id = `${prefix}/${layer.id}`
    build.refCopyAncestry.set(id, ancestry)
    return {
      ...layer,
      id,
      children: layer.children && copiedLayers(layer.children, prefix, ancestry, build)
    }
  })
}

/** Descendant overrides with the use's on top, merged field by field where both name a path. */
function mergedDescendants(
  middle: PenNode['descendants'],
  own: PenNode['descendants']
): PenNode['descendants'] {
  if (!middle || !own) return middle ?? own
  const merged = { ...middle }
  for (const [path, override] of Object.entries(own)) {
    const under = merged[path]
    // A replacement layer (one naming its type) takes the path whole, as it does on its own.
    merged[path] = under && !override.type ? { ...under, ...override } : override
  }
  return merged
}

/**
 * A reusable component can itself be a `ref` to another component, with its own fields,
 * children, and overrides. pen.dev reads a use of it as a use of the base component that
 * carries the middle component's fields, children, and overrides under the use's own.
 * `copiedChildren` is whether the result's children are copies already named for the use.
 */
function throughRefComponents(
  pen: PenNode,
  build: Build
): { pen: PenNode; copiedChildren: boolean } {
  let current = pen
  let copiedChildren = false
  const ancestry = build.refCopyAncestry.get(pen.id) ?? NO_ANCESTRY
  for (let depth = 0; depth < MAX_REF_COMPONENT_DEPTH; depth++) {
    if (current.type !== 'ref' || !current.ref) break
    const component = build.components.get(current.ref)
    if (component?.type !== 'ref' || !component.ref) break
    const { id: _id, reusable: _reusable, x: _x, y: _y, name: _name, ...middle } = component
    const { ref: _ref, type: _type, ...own } = current
    const theme = { ...middle.theme, ...own.theme }
    // A copy inside this component's own children does not take them again, so a cycle of
    // components ends instead of copying without end.
    const inherits = !own.children && middle.children && !ancestry.has(component.id)
    const children = inherits
      ? copiedLayers(middle.children ?? [], pen.id, new Set([...ancestry, component.id]), build)
      : own.children
    copiedChildren ||= Boolean(inherits)
    current = {
      ...middle,
      ...own,
      type: 'ref',
      ref: component.ref,
      name: own.name ?? component.name,
      theme: Object.keys(theme).length > 0 ? theme : undefined,
      descendants: mergedDescendants(middle.descendants, own.descendants),
      children
    }
  }
  return { pen: current, copiedChildren }
}

/** Builds a layer and its children in the layer's theme, merged over its parent's. */
export function createSceneNode(layer: PenNode, parentId: string, build: Build): string | null {
  if (layer.type === 'prompt') return null
  const { pen, copiedChildren } = throughRefComponents(layer, build)
  const component = pen.type === 'ref' && pen.ref ? build.components.get(pen.ref) : undefined
  // A component that is not a frame has no instances; its uses are plain copies.
  const instanceOf = pen.type === 'ref' && component?.type === 'frame' ? component : undefined
  const fields = pen.type === 'ref' ? instanceFields(pen, component) : pen
  const iconInstance = fields.type === 'icon' && insideComponent(build.graph, parentId)
  const leaveTheme = fields.theme ? build.ctx.enterTheme(fields.theme) : undefined
  try {
    const type = instanceOf || iconInstance ? 'INSTANCE' : sceneType(fields)
    const node = build.graph.createNode(type, parentId, { id: pen.id })
    applyPenProperties(node, fields, build)
    if (instanceOf) {
      node.componentId = instanceOf.id
      build.instances.set(node.id, pen)
    } else {
      // Children a middle component gave are copies named for this use already.
      if (copiedChildren) {
        for (const child of pen.children ?? []) createSceneNode(child, node.id, build)
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
    }
    return node.id
  } finally {
    leaveTheme?.()
  }
}
