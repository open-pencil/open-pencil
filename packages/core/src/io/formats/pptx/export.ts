import type PptxGenJS from 'pptxgenjs'

import type { Fill, Mat3, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { TransformMatrix, getWorldMatrix } from '@open-pencil/scene-graph'

import { encodeBase64 } from '#core/bytes'

import {
  hasUnsupportedTransform,
  inch,
  nodeBox,
  nodeScale,
  pt,
  transformNodeVector,
  type SlideBox
} from './geometry'
import { makeIsolatedRasterize } from './rasterize'
import {
  applyTextCase,
  effectiveRadius,
  firstVisibleFill,
  firstVisibleStroke,
  getSolidOffsetShadow,
  hasAsymmetricCorners,
  hex,
  isRounded,
  mapHAlign,
  mapShadow,
  mapVAlign,
  round2,
  transparency
} from './style'
import type {
  PPTXExportOptions,
  PPTXExportStats,
  PPTXRasterize,
  PPTXRasterizeOptions
} from './types'

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

interface ExportCtx {
  slide: PptxGenJS.Slide
  graph: SceneGraph
  rasterize: PPTXRasterize
  /** frame px → slide inch conversion factor */
  pxPerInch: number
  /** world → slide-frame local space, so a rotated slide frame stays upright */
  toSlideSpace: Mat3
  offsetX: number
  offsetY: number
  contentFillsSlide: boolean
  fallbackScale: number
  stats: PPTXExportStats
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
  const firstWidth = Math.max(first.width, 1)
  const firstHeight = Math.max(first.height, 1)
  const slideW = firstWidth >= firstHeight ? BASE_SLIDE_WIDTH_IN : 7.5
  const slideH = slideW * (firstHeight / firstWidth)

  const pptx = new PptxGen()
  pptx.defineLayout({ name: 'SCENE', width: slideW, height: slideH })
  pptx.layout = 'SCENE'

  const rasterize = options.rasterize ?? makeIsolatedRasterize(graph, options.context)

  const stats: PPTXExportStats = { editable: 0, fallback: 0, skipped: 0, fallbackReasons: {} }

  for (const root of roots) {
    const rootWidth = Math.max(root.width, 1)
    const rootHeight = Math.max(root.height, 1)
    const inchesPerPixel = Math.min(slideW / rootWidth, slideH / rootHeight)
    const contentWidth = rootWidth * inchesPerPixel
    const contentHeight = rootHeight * inchesPerPixel
    const offsetX = (slideW - contentWidth) / 2
    const offsetY = (slideH - contentHeight) / 2
    const slide = pptx.addSlide()
    const ctx: ExportCtx = {
      slide,
      graph,
      rasterize,
      pxPerInch: 1 / inchesPerPixel,
      toSlideSpace:
        TransformMatrix.invert(getWorldMatrix(root, graph)) ?? TransformMatrix.identity(),
      offsetX,
      offsetY,
      contentFillsSlide: Math.abs(offsetX) < 1e-6 && Math.abs(offsetY) < 1e-6,
      fallbackScale: options.fallbackScale ?? 2,
      stats
    }

    if (root.type !== 'FRAME') {
      // Non-frame root: export as a single image on its own slide.
      await addFallbackImage(ctx, root, root.opacity, `root node type ${root.type}`)
      continue
    }

    const contentFallbackReason = rootContentFallbackReason(ctx, root)
    if (contentFallbackReason) {
      await addFallbackImage(ctx, root, root.opacity, contentFallbackReason)
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

// ── Tree traversal ────────────────────────────────────────

async function walkNode(ctx: ExportCtx, node: SceneNode, inheritedOpacity: number): Promise<void> {
  if (!node.visible) {
    ctx.stats.skipped += 1
    return
  }
  const opacity = inheritedOpacity * node.opacity

  const fallbackReason = getFallbackReason(ctx, node)
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
    ctx.contentFillsSlide &&
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

/** Why a slide frame's content must be rasterized as one composited image. */
function rootContentFallbackReason(ctx: ExportCtx, root: SceneNode): string | null {
  if (
    root.childIds.some((id) => {
      const child = ctx.graph.getNode(id)
      return child?.visible === true && child.isMask
    })
  ) {
    return 'contains mask'
  }
  if (clipsOverflowingContent(ctx.graph, root)) return 'clipped content'
  return null
}

/** Why a slide frame's own paint has to be rasterized. Null means it maps natively. */
function rootRasterReason(root: SceneNode): string | null {
  if (!SIMPLE_BLENDS.has(root.blendMode)) return 'blend mode'
  // A drop shadow on the slide frame paints outside the slide, where nothing is
  // visible — rasterizing the whole slide for it would only cost editability.
  if (root.effects.some((e) => e.visible && e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW'))
    return 'blur effect'
  const shadowReason = getShadowFallbackReason(root)
  if (shadowReason) return shadowReason
  if (hasAsymmetricCorners(root)) return 'asymmetric corners'
  if (root.strokes.filter((stroke) => stroke.visible).length > 1) return 'multiple strokes'
  const fills = root.fills.filter((f) => f.visible)
  if (fills.length > 1) return 'multiple fills'
  if (fills[0] && fills[0].type !== 'SOLID') return 'non-solid frame background'
  return null
}

function getShadowFallbackReason(node: SceneNode): string | null {
  const shadows = node.effects.filter(
    (effect) => effect.visible && (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW')
  )
  if (shadows.length > 1) return 'multiple shadows'
  if (shadows.length === 0) return null
  const shadow = shadows[0]
  if (shadow.spread !== 0 && getSolidOffsetShadow(node) !== shadow) return 'shadow spread'
  return null
}

/** Why a node cannot be converted natively. Null means native conversion is possible. */
function getFallbackReason(ctx: ExportCtx, node: SceneNode): string | null {
  const commonReason = getCommonFallbackReason(ctx, node)
  if (commonReason) return commonReason
  if (node.type === 'TEXT') return getTextFallbackReason(node)
  if (SHAPE_TYPES.has(node.type) || CONTAINER_TYPES.has(node.type)) {
    return getShapeFallbackReason(node)
  }
  return `node type ${node.type}`
}

function getCommonFallbackReason(ctx: ExportCtx, node: SceneNode): string | null {
  const { graph } = ctx
  if (hasUnsupportedTransform(ctx, node)) return 'unsupported transform'
  if (!SIMPLE_BLENDS.has(node.blendMode)) return 'blend mode'
  if (node.effects.some((e) => e.visible && e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW'))
    return 'blur effect'
  const shadowReason = getShadowFallbackReason(node)
  if (shadowReason) return shadowReason
  if (hasAsymmetricCorners(node)) return 'asymmetric corners'
  if (node.strokes.filter((stroke) => stroke.visible).length > 1) return 'multiple strokes'
  if (node.childIds.some((id) => graph.getNode(id)?.isMask)) return 'contains mask'
  if (clipsOverflowingContent(graph, node)) return 'clipped content'
  if (isVectorOnlyContainer(graph, node)) return 'vector graphics'
  return null
}

function getTextFallbackReason(node: SceneNode): string | null {
  const fills = node.fills.filter((fill) => fill.visible)
  if (fills.length > 1) return 'multiple text fills'
  if (fills[0] && fills[0].type !== 'SOLID') return 'non-solid text fill'
  if (node.strokes.some((stroke) => stroke.visible)) return 'text stroke'
  for (const run of node.styleRuns) {
    const runFills = run.style.fills?.filter((fill) => fill.visible) ?? []
    if (runFills.length > 1 || runFills.some((fill) => fill.type !== 'SOLID')) {
      return 'unsupported text run fill'
    }
  }
  return null
}

function getShapeFallbackReason(node: SceneNode): string | null {
  const visibleFills = node.fills.filter((fill) => fill.visible)
  if (visibleFills.some((fill) => fill.type.startsWith('GRADIENT'))) return 'gradient fill'
  if (visibleFills.length > 1) return 'multiple fills'
  // Image-fill leaves become native pictures at the call site; containers
  // with an image background fall back so children stay aligned.
  if (visibleFills.some((fill) => fill.type === 'IMAGE') && node.childIds.length > 0) {
    return 'image background container'
  }
  return null
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
      const outsideX = corners[i] < -CLIP_EPSILON_PX || corners[i] > node.width + CLIP_EPSILON_PX
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
    const scale = nodeScale(ctx, node)
    ctx.slide.addShape('roundRect', {
      ...common,
      rectRadius: Math.min(
        inch(ctx, effectiveRadius(node) * Math.min(scale.x, scale.y)),
        Math.min(box.w, box.h) / 2
      )
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
    data: `data:image/png;base64,${encodeBase64(data)}`,
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

/** letterSpacing px → PPT charSpacing (pt). Zero is omitted (default). */
function charSpacingPt(ctx: ExportCtx, px: number): number | undefined {
  if (!px) return undefined
  return round2(pt(ctx, px))
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
  const offset = transformNodeVector(ctx, node, shadow.offset)
  const scale = nodeScale(ctx, node)
  const spreadX = inch(ctx, sp * scale.x)
  const spreadY = inch(ctx, sp * scale.y)
  let shapeType: 'roundRect' | 'ellipse' | 'rect' = 'rect'
  if (isRounded(node)) shapeType = 'roundRect'
  else if (node.type === 'ELLIPSE') shapeType = 'ellipse'
  ctx.slide.addShape(shapeType, {
    x: box.x + offset.x - spreadX,
    y: box.y + offset.y - spreadY,
    w: box.w + spreadX * 2,
    h: box.h + spreadY * 2,
    rotate: box.rotate,
    flipH: box.flipH,
    fill: {
      color: hex(shadow.color),
      transparency: transparency(opacity * shadow.color.a)
    },
    line: { color: 'FFFFFF', transparency: 100, width: 0 },
    ...(shapeType === 'roundRect'
      ? {
          rectRadius: Math.min(
            inch(ctx, effectiveRadius(node) * Math.min(scale.x, scale.y)),
            Math.min(box.w, box.h) / 2
          )
        }
      : {})
  })
}
