import type PptxGenJS from 'pptxgenjs'
import type { CanvasKit } from 'canvaskit-wasm'

import type { Fill, Mat3, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { TransformMatrix, getWorldMatrix } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas'
import { extractExportGraph } from '#core/io/subgraph'

import {
  applyTextCase,
  clampRot,
  effectiveRadius,
  firstVisibleFill,
  firstVisibleStroke,
  getSolidOffsetShadow,
  hex,
  isRounded,
  mapHAlign,
  mapShadow,
  mapVAlign,
  round2,
  transparency
} from './style'

/**
 * Scene graph → editable PPTX hybrid conversion.
 *
 * Text, rectangles, ellipses and lines become native (editable) PowerPoint
 * elements; vectors, gradients, masks and blended subtrees fall back to PNG
 * images. Unit conversion uses exact formulas — px→inch for positions/sizes and
 * px→pt for fonts, letter spacing, line height and stroke widths (1in = 96px =
 * 72pt) — with no hand-tuned factors.
 *
 * Each requested top-level FRAME becomes one slide. Non-frame roots are
 * exported as a single image on their own slide.
 */

const MIN_SIZE_IN = 0.01
const BASE_SLIDE_WIDTH_IN = 13.333
/** Sub-pixel slack when testing whether a clipped container actually crops. */
const CLIP_EPSILON_PX = 0.5
const SIMPLE_BLENDS = new Set<SceneNode['blendMode']>(['NORMAL', 'PASS_THROUGH'])
/** Node types that map to native PPT shapes. Others recurse or fall back to PNG. */
const SHAPE_TYPES = new Set<SceneNode['type']>([
  'FRAME',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'LINE'
])
const CONTAINER_TYPES = new Set<SceneNode['type']>(['FRAME', 'GROUP', 'SECTION'])

export interface PPTXExportStats {
  editable: number
  fallback: number
  skipped: number
  /** Fallback reason → count, for fidelity measurement. */
  fallbackReasons: Record<string, number>
}

export interface PPTXRasterizeOptions {
  /** Render only the nodes' own paint, dropping their children. */
  paintOnly?: boolean
}

/** Renders the given nodes to a PNG byte array (used for fallback images). */
export type PPTXRasterize = (
  nodeIds: string[],
  scale: number,
  options?: PPTXRasterizeOptions
) => Promise<Uint8Array | null>

export interface PPTXExportOptions {
  /** Raster scale for fallback images. Defaults to 2. */
  fallbackScale?: number
  /**
   * Custom rasterizer for fallback images. Defaults to an isolated render of
   * the node subtree (ancestor backgrounds cleared) through the raster
   * pipeline — headless, or renderer-bound when `context` provides one.
   */
  rasterize?: PPTXRasterize
  /** Live renderer to reuse for fallback rasterization (browser contexts). */
  context?: { canvasKit?: CanvasKit; renderer?: SkiaRenderer }
  /** Receives conversion statistics after the export completes. */
  onStats?: (stats: PPTXExportStats) => void
}

interface ExportCtx {
  slide: PptxGenJS.Slide
  graph: SceneGraph
  rasterize: PPTXRasterize
  /** frame px → slide inch conversion factor */
  pxPerInch: number
  /** world → slide-frame local space, so a rotated slide frame stays upright */
  toSlideSpace: Mat3
  fallbackScale: number
  stats: PPTXExportStats
}

/** Placement of a node on the slide, in inches, plus its transform. */
interface SlideBox {
  x: number
  y: number
  w: number
  h: number
  rotate: number
  flipH: boolean
}

export async function renderNodesToPPTX(
  graph: SceneGraph,
  _pageId: string,
  nodeIds: string[],
  options: PPTXExportOptions = {}
): Promise<Uint8Array | null> {
  const roots = nodeIds
    .map((id) => graph.getNode(id))
    .filter((node): node is SceneNode => node?.visible === true)
  if (!roots.length) return null

  const { default: PptxGen } = await import('pptxgenjs')

  const first = roots[0]
  const slideW = first.width >= first.height ? BASE_SLIDE_WIDTH_IN : 7.5
  const slideH = slideW * (first.height / first.width)
  const pxPerInch = first.width / slideW

  const pptx = new PptxGen()
  pptx.defineLayout({ name: 'SCENE', width: slideW, height: slideH })
  pptx.layout = 'SCENE'

  const rasterize =
    options.rasterize ?? makeIsolatedRasterize(graph, options.context)

  const stats: PPTXExportStats = { editable: 0, fallback: 0, skipped: 0, fallbackReasons: {} }

  for (const root of roots) {
    const slide = pptx.addSlide()
    const ctx: ExportCtx = {
      slide,
      graph,
      rasterize,
      pxPerInch,
      toSlideSpace: TransformMatrix.invert(getWorldMatrix(root, graph)) ?? TransformMatrix.identity(),
      fallbackScale: options.fallbackScale ?? 2,
      stats
    }

    if (root.type !== 'FRAME') {
      // Non-frame root: export as a single image on its own slide.
      await addFallbackImage(ctx, root, root.opacity, `root node type ${root.type}`)
      continue
    }

    await addSlideFramePaint(ctx, root)

    for (const childId of root.childIds) {
      const child = graph.getNode(childId)
      if (child) await walkNode(ctx, child, root.opacity)
    }
  }

  const raw = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
  options.onStats?.(stats)
  return new Uint8Array(raw)
}

/**
 * Renders a node subtree in isolation: the selection extraction keeps the full
 * ancestor chain (so clipping still applies), but ancestor paints are cleared —
 * otherwise every fallback image would carry an opaque copy of the slide
 * background behind it.
 */
function makeIsolatedRasterize(
  graph: SceneGraph,
  context?: PPTXExportOptions['context']
): PPTXRasterize {
  return async (nodeIds: string[], scale: number, options?: PPTXRasterizeOptions) => {
    const extracted = extractExportGraph(graph, { scope: 'selection', nodeIds })
    if (!extracted.pageId || extracted.nodeIds.length === 0) return null

    if (options?.paintOnly) {
      // The extracted graph is a copy, so detaching the children only affects
      // this render — the renderer walks the tree through childIds.
      for (const nodeId of extracted.nodeIds) {
        const node = extracted.graph.getNode(nodeId)
        if (node) node.childIds = []
      }
    }

    const targets = new Set(extracted.nodeIds)
    for (const nodeId of extracted.nodeIds) {
      let cursor = extracted.graph.getNode(nodeId)?.parentId ?? null
      while (cursor) {
        const ancestor = extracted.graph.getNode(cursor)
        if (!ancestor || targets.has(ancestor.id)) break
        ancestor.fills = []
        ancestor.strokes = []
        ancestor.effects = []
        cursor = ancestor.parentId
      }
    }

    const raster = await import('#core/io/formats/raster')
    const ck = context?.canvasKit
    const renderer = context?.renderer
    if (ck && renderer) {
      return raster.renderNodesToImage(ck, renderer, extracted.graph, extracted.pageId, extracted.nodeIds, {
        scale,
        format: 'PNG'
      })
    }
    return raster.headlessRenderNodes(extracted.graph, extracted.pageId, extracted.nodeIds, {
      scale,
      format: 'PNG'
    })
  }
}

// ── Tree traversal ────────────────────────────────────────

async function walkNode(ctx: ExportCtx, node: SceneNode, inheritedOpacity: number): Promise<void> {
  if (!node.visible) {
    ctx.stats.skipped += 1
    return
  }
  const opacity = inheritedOpacity * node.opacity

  const fallbackReason = getFallbackReason(ctx.graph, node)
  if (fallbackReason) {
    await addFallbackImage(ctx, node, opacity, fallbackReason)
    return
  }

  if (node.type === 'TEXT') {
    addEditableText(ctx, node, opacity)
    return
  }

  // Leaf with an image fill → native picture (movable/replaceable).
  if (isImageLeaf(node)) {
    await addFallbackImage(ctx, node, opacity, null)
    ctx.stats.editable += 1
    return
  }

  if (SHAPE_TYPES.has(node.type)) addEditableShape(ctx, node, opacity)

  if (CONTAINER_TYPES.has(node.type)) {
    for (const childId of node.childIds) {
      const child = ctx.graph.getNode(childId)
      if (child) await walkNode(ctx, child, opacity)
    }
  }
}

/**
 * Paints the slide frame itself. A plain solid fill becomes the slide
 * background; a stroke, corner radius or translucency still maps to a native
 * shape covering the slide. Only paint PPTX cannot express at all is
 * rasterized, and then *without* the frame's children — they are converted
 * natively right after, and baking them into the image too would draw every
 * element twice.
 */
async function addSlideFramePaint(ctx: ExportCtx, root: SceneNode): Promise<void> {
  const reason = rootRasterReason(root)
  if (reason) {
    await addFallbackImage(ctx, root, root.opacity, reason, { paintOnly: true })
    return
  }

  const bg = firstVisibleFill(root)
  const plainBackground =
    !root.strokes.some((s) => s.visible) &&
    !root.effects.some((e) => e.visible && e.type === 'INNER_SHADOW') &&
    effectiveRadius(root) === 0
  if (bg?.type === 'SOLID' && plainBackground) {
    ctx.slide.background = {
      color: hex(bg.color),
      transparency: transparency(root.opacity * bg.opacity * bg.color.a)
    }
    return
  }
  addEditableShape(ctx, root, root.opacity)
}

/** Why a slide frame's own paint has to be rasterized. Null means it maps natively. */
function rootRasterReason(root: SceneNode): string | null {
  if (!SIMPLE_BLENDS.has(root.blendMode)) return 'blend mode'
  // A drop shadow on the slide frame paints outside the slide, where nothing is
  // visible — rasterizing the whole slide for it would only cost editability.
  if (root.effects.some((e) => e.visible && e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW'))
    return 'blur effect'
  const fills = root.fills.filter((f) => f.visible)
  if (fills.length > 1) return 'multiple fills'
  if (fills[0] && fills[0].type !== 'SOLID') return 'non-solid frame background'
  return null
}

/** Why a node cannot be converted natively. Null means native conversion is possible. */
function getFallbackReason(graph: SceneGraph, node: SceneNode): string | null {
  if (!SIMPLE_BLENDS.has(node.blendMode)) return 'blend mode'
  if (node.effects.some((e) => e.visible && e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW'))
    return 'blur effect'
  if (node.childIds.some((id) => graph.getNode(id)?.isMask)) return 'contains mask'
  // PPTX has no container clipping — a clipped frame and its children arrive as
  // sibling elements, so whatever the frame crops would reappear. Rasterizing
  // the subtree keeps the crop.
  if (clipsOverflowingContent(graph, node)) return 'clipped content'
  // Icon-style containers (every visible child is a vector path) rasterize as
  // ONE image — per-path fallbacks would stack overlapping PNGs and lose the
  // composed artwork.
  if (isVectorOnlyContainer(graph, node)) return 'vector graphics'

  if (node.type === 'TEXT') {
    // Only gradient fills force a fallback — partial styles map to native runs.
    const fill = firstVisibleFill(node)
    if (fill && fill.type !== 'SOLID') return 'non-solid text fill'
    return null
  }

  if (SHAPE_TYPES.has(node.type) || CONTAINER_TYPES.has(node.type)) {
    const visibleFills = node.fills.filter((f) => f.visible)
    if (visibleFills.some((f) => f.type.startsWith('GRADIENT'))) return 'gradient fill'
    if (visibleFills.length > 1) return 'multiple fills'
    // Image-fill leaves become native pictures at the call site; containers
    // with an image background fall back so children stay aligned.
    if (visibleFills.some((f) => f.type === 'IMAGE') && node.childIds.length > 0)
      return 'image background container'
    return null
  }

  return `node type ${node.type}`
}

function isImageLeaf(node: SceneNode): boolean {
  return node.childIds.length === 0 && node.fills.some((f) => f.visible && f.type === 'IMAGE')
}

/** True when `node` clips and some descendant actually reaches past its bounds. */
function clipsOverflowingContent(graph: SceneGraph, node: SceneNode): boolean {
  if (!node.clipsContent || !CONTAINER_TYPES.has(node.type)) return false
  const toNodeSpace = TransformMatrix.invert(getWorldMatrix(node, graph))
  if (!toNodeSpace) return false

  const pending = [...node.childIds]
  while (pending.length > 0) {
    const childId = pending.pop()
    const child = childId ? graph.getNode(childId) : undefined
    if (!child?.visible) continue
    const local = TransformMatrix.multiply(toNodeSpace, getWorldMatrix(child, graph))
    const corners = TransformMatrix.mapPoints(local, [
      0,
      0,
      child.width,
      0,
      child.width,
      child.height,
      0,
      child.height
    ])
    for (let i = 0; i < corners.length; i += 2) {
      const outsideX =
        corners[i] < -CLIP_EPSILON_PX || corners[i] > node.width + CLIP_EPSILON_PX
      const outsideY =
        corners[i + 1] < -CLIP_EPSILON_PX || corners[i + 1] > node.height + CLIP_EPSILON_PX
      if (outsideX || outsideY) return true
    }
    pending.push(...child.childIds)
  }
  return false
}

function isVectorOnlyContainer(graph: SceneGraph, node: SceneNode): boolean {
  if (!CONTAINER_TYPES.has(node.type)) return false
  const children = node.childIds
    .map((id) => graph.getNode(id))
    .filter((child): child is SceneNode => child?.visible === true)
  return children.length > 0 && children.every((child) => child.type === 'VECTOR')
}

// ── Native element conversion ─────────────────────────────

function addEditableShape(ctx: ExportCtx, node: SceneNode, opacity: number): void {
  const fill = firstVisibleFill(node)
  const stroke = firstVisibleStroke(node)
  if (!fill && !stroke) return // paintless container

  const box = nodeBox(ctx, node)
  const solidShadow = getSolidOffsetShadow(node)
  if (solidShadow) addSolidShadowShape(ctx, node, box, opacity, solidShadow)
  const common = {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotate: box.rotate,
    flipH: box.flipH,
    shadow: solidShadow ? undefined : mapShadow(node, opacity),
    fill:
      fill?.type === 'SOLID'
        ? {
            color: hex(fill.color),
            transparency: transparency(opacity * fill.opacity * fill.color.a)
          }
        : { color: 'FFFFFF', transparency: 100 },
    line: stroke
      ? {
          color: hex(stroke.color),
          width: pt(ctx, stroke.weight),
          transparency: transparency(opacity * stroke.opacity * stroke.color.a),
          dashType: (stroke.dashPattern?.length ?? 0) > 0 ? ('dash' as const) : ('solid' as const)
        }
      : { color: 'FFFFFF', transparency: 100, width: 0 }
  }

  if (node.type === 'LINE') {
    const paint = stroke ?? fill
    if (!paint) return
    ctx.slide.addShape('line', {
      ...common,
      line: {
        color: hex(paint.color),
        width: Math.max(pt(ctx, stroke?.weight ?? node.height), 0.25),
        transparency: transparency(opacity * paint.opacity * paint.color.a)
      }
    })
  } else if (node.type === 'ELLIPSE') {
    ctx.slide.addShape('ellipse', common)
  } else if (isRounded(node)) {
    ctx.slide.addShape('roundRect', {
      ...common,
      rectRadius: Math.min(inch(ctx, effectiveRadius(node)), Math.min(box.w, box.h) / 2)
    })
  } else {
    ctx.slide.addShape('rect', common)
  }
  ctx.stats.editable += 1
}

function addEditableText(ctx: ExportCtx, node: SceneNode, opacity: number): void {
  if (!node.text) {
    ctx.stats.skipped += 1
    return
  }
  const box = nodeBox(ctx, node)
  const singleLine = node.maxLines === 1 || node.textAutoResize === 'WIDTH_AND_HEIGHT'

  const runs = buildTextRuns(ctx, node, opacity)
  ctx.slide.addText(runs, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotate: box.rotate,
    flipH: box.flipH,
    align: mapHAlign(node.textAlignHorizontal),
    valign: mapVAlign(node.textAlignVertical),
    margin: 0,
    wrap: !singleLine,
    // If the receiving app reflows text past the box, shrink to avoid layout
    // breakage; otherwise this has no effect.
    fit: 'shrink',
    lineSpacing: node.lineHeight != null ? pt(ctx, node.lineHeight) : undefined,
    shadow: mapShadow(node, opacity)
  })
  ctx.stats.editable += 1
}

/** Merges styleRuns with base style into PPT text runs (keeps partial styling editable). */
function buildTextRuns(ctx: ExportCtx, node: SceneNode, opacity: number): PptxGenJS.TextProps[] {
  const text = applyTextCase(node.text, node.textCase)

  interface Seg {
    start: number
    end: number
    style: Partial<SceneNode> & { fills?: Fill[] }
  }
  const segs: Seg[] = []
  const sorted = [...node.styleRuns].sort((a, b) => a.start - b.start)
  let cursor = 0
  for (const run of sorted) {
    const start = Math.max(run.start, cursor)
    const end = Math.min(run.start + run.length, text.length)
    if (start > cursor) segs.push({ start: cursor, end: start, style: {} })
    if (end > start) segs.push({ start, end, style: run.style })
    cursor = Math.max(cursor, end)
  }
  if (cursor < text.length) segs.push({ start: cursor, end: text.length, style: {} })
  if (segs.length === 0) segs.push({ start: 0, end: text.length, style: {} })

  const baseFill = firstVisibleFill(node)
  return segs.map((seg) => {
    const s = seg.style
    const fill = s.fills?.find((f) => f.visible && f.type === 'SOLID') ?? baseFill
    const fontSize = s.fontSize ?? node.fontSize
    const weight = s.fontWeight ?? node.fontWeight
    const deco = s.textDecoration ?? node.textDecoration
    return {
      text: text.slice(seg.start, seg.end),
      options: {
        fontFace: s.fontFamily ?? node.fontFamily,
        fontSize: round2(pt(ctx, fontSize)),
        bold: weight >= 600,
        italic: s.italic ?? node.italic,
        color: fill ? hex(fill.color) : '000000',
        transparency: transparency(opacity * (fill ? fill.opacity * fill.color.a : 1)),
        charSpacing: charSpacingPt(ctx, s.letterSpacing ?? node.letterSpacing),
        underline: deco === 'UNDERLINE' ? { style: 'sng' as const } : undefined,
        strike: deco === 'STRIKETHROUGH' ? ('sngStrike' as const) : undefined
      }
    }
  })
}

async function addFallbackImage(
  ctx: ExportCtx,
  node: SceneNode,
  opacity: number,
  reason: string | null,
  options?: PPTXRasterizeOptions
): Promise<void> {
  const data = await ctx.rasterize([node.id], ctx.fallbackScale, options)
  if (!data) {
    ctx.stats.skipped += 1
    return
  }
  const box = nodeBox(ctx, node)
  ctx.slide.addImage({
    data: `data:image/png;base64,${bytesToBase64(data)}`,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    rotate: box.rotate,
    flipH: box.flipH,
    transparency: transparency(opacity)
  })
  if (reason) {
    ctx.stats.fallback += 1
    ctx.stats.fallbackReasons[reason] = (ctx.stats.fallbackReasons[reason] ?? 0) + 1
  }
}

// ── Unit and style mapping (exact formulas, no hand tuning) ──

function inch(ctx: ExportCtx, px: number): number {
  return px / ctx.pxPerInch
}

/** px → pt. 1in = 96px (scene units) = 72pt. */
function pt(ctx: ExportCtx, px: number): number {
  return (px * 72) / ctx.pxPerInch
}

/** letterSpacing px → PPT charSpacing (pt). Zero is omitted (default). */
function charSpacingPt(ctx: ExportCtx, px: number): number | undefined {
  if (!px) return undefined
  return round2(pt(ctx, px))
}

/**
 * PowerPoint places an element by the top-left of its *unrotated* box and then
 * rotates it around its own center, so both the center and the rotation are read
 * off the node's transform relative to the slide frame. Deriving them from
 * `getAbsolutePosition()` plus `node.rotation` instead would misplace rotated
 * nodes (that position is the rotated corner) and drop rotation inherited from
 * ancestors.
 */
function nodeBox(ctx: ExportCtx, node: SceneNode): SlideBox {
  const local = TransformMatrix.multiply(ctx.toSlideSpace, getWorldMatrix(node, ctx.graph))
  const [centerX, centerY] = TransformMatrix.mapPoints(local, [node.width / 2, node.height / 2])
  // A mirrored basis (negative determinant) is a flip, which PPTX expresses
  // separately from rotation — folding it into the angle would spin the shape.
  const mirrored = local[0] * local[4] - local[1] * local[3] < 0
  const radians = mirrored ? Math.atan2(-local[3], local[4]) : Math.atan2(local[3], local[0])
  const w = Math.max(inch(ctx, node.width), MIN_SIZE_IN)
  const h = Math.max(inch(ctx, node.height), MIN_SIZE_IN)
  return {
    x: inch(ctx, centerX) - w / 2,
    y: inch(ctx, centerY) - h / 2,
    w,
    h,
    rotate: clampRot(round2((radians * 180) / Math.PI)),
    flipH: mirrored
  }
}

/**
 * Solid offset shadows (blur 0) cannot be represented crisply with PPT shadow
 * properties (viewers render them soft), so draw a same-shaped solid shape at
 * the offset position instead.
 */
function addSolidShadowShape(
  ctx: ExportCtx,
  node: SceneNode,
  box: SlideBox,
  opacity: number,
  shadow: NonNullable<ReturnType<typeof getSolidOffsetShadow>>
): void {
  const sp = shadow.spread
  let shapeType: 'roundRect' | 'ellipse' | 'rect' = 'rect'
  if (isRounded(node)) shapeType = 'roundRect'
  else if (node.type === 'ELLIPSE') shapeType = 'ellipse'
  ctx.slide.addShape(shapeType, {
    x: box.x + inch(ctx, shadow.offset.x - sp),
    y: box.y + inch(ctx, shadow.offset.y - sp),
    w: box.w + inch(ctx, sp * 2),
    h: box.h + inch(ctx, sp * 2),
    rotate: box.rotate,
    flipH: box.flipH,
    fill: {
      color: hex(shadow.color),
      transparency: transparency(opacity * shadow.color.a)
    },
    line: { color: 'FFFFFF', transparency: 100, width: 0 },
    ...(shapeType === 'roundRect'
      ? { rectRadius: Math.min(inch(ctx, effectiveRadius(node)), Math.min(box.w, box.h) / 2) }
      : {})
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
