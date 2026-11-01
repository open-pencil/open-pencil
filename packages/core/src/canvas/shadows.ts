import type { Canvas, ImageFilter } from 'canvaskit-wasm'

import type { BlendMode, Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import Matrix from '@open-pencil/scene-graph/matrix'
import { isLayerContainer } from '@open-pencil/scene-graph/node-defaults'
import { regionFills } from '@open-pencil/scene-graph/vector-network'

import { nodeOrientationMatrix } from '#core/geometry'

import { needsIsolatedBlendLayer, setPaintBlendMode } from './blend'
import { makeBooleanOperationPath } from './boolean'
import { blurSigma, renderNoiseEffects } from './effects'
import type { SkiaRenderer } from './renderer'
import {
  castsFromOwnShape,
  castsOwnShapeDropShadow,
  clipOutShapeKnockout,
  drawOutlineDropShadow,
  drawRingDropShadow,
  drawShapeDropShadow,
  drawShapeInnerShadow,
  regularStrokeOutline,
  strokeGrowsOutline
} from './shadows/shape'
import {
  drawSilhouette,
  fillsCastShadow,
  paintsCastShadow,
  paintsOverKnockout,
  shadowIncludesChildren,
  silhouetteBounds,
  separateShadowChildren
} from './shadows/silhouette'
function resetEffectLayerPaint(r: SkiaRenderer): void {
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
}

/** `behind` draws drop shadows and background blur, `inner` inner shadows over fills, `front` noise. */
export type EffectPass = 'behind' | 'inner' | 'front'

/**
 * Layers whose shadows Figma 126 never spreads: only boxes and ellipses, arcs among them, take a
 * spread, for drop and inner shadows alike.
 */
const UNSPREAD_TYPES: ReadonlySet<SceneNode['type']> = new Set<SceneNode['type']>([
  'TEXT',
  'BOOLEAN_OPERATION',
  'STAR',
  'POLYGON',
  'VECTOR'
])

/** Figma spreads a shadow only where it follows the layer's own outline: shapes and filled frames that clip. */
function shadowSpread(node: SceneNode, effect: Effect): number {
  if (UNSPREAD_TYPES.has(node.type)) return 0
  if (!isLayerContainer(node)) return effect.spread
  return node.clipsContent && fillsCastShadow(node) ? effect.spread : 0
}

/** The spread an inner shadow takes, inside any layer whose type Figma spreads. */
function innerShadowSpread(node: SceneNode, effect: Effect): number {
  return UNSPREAD_TYPES.has(node.type) ? 0 : effect.spread
}

function shadowLayerBounds(
  r: SkiaRenderer,
  graph: SceneGraph,
  node: SceneNode,
  effect: Effect,
  spread: number,
  includeChildren: boolean
): Float32Array {
  const box = silhouetteBounds(graph, node, includeChildren) ?? {
    x: 0,
    y: 0,
    width: node.width,
    height: node.height
  }
  const offset = effect.offset
  const padding = effect.radius * 2 + Math.abs(spread)
  return r.ck.LTRBRect(
    box.x + Math.min(0, offset.x) - padding,
    box.y + Math.min(0, offset.y) - padding,
    box.x + box.width + Math.max(0, offset.x) + padding,
    box.y + box.height + Math.max(0, offset.y) + padding
  )
}

/** Grows or shrinks a silhouette by the spread, square as Figma spreads a rectangle. */
function spreadFilter(r: SkiaRenderer, spread: number): ImageFilter | null {
  if (spread > 0) return r.ck.ImageFilter.MakeDilate(spread, spread, null)
  if (spread < 0) return r.ck.ImageFilter.MakeErode(-spread, -spread, null)
  return null
}

/** Draws a shadow cast by whatever `draw` paints: its alpha is the outline, offset and blurred. */
function drawSilhouetteDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  effect: Effect,
  spread: number,
  bounds: Float32Array,
  blendMode: BlendMode | undefined,
  draw: () => void
): void {
  const ck = r.ck
  const color = ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
  const sigma = blurSigma(effect.radius)
  const morphology = spreadFilter(r, spread)
  const filter = morphology
    ? ck.ImageFilter.MakeDropShadowOnly(
        effect.offset.x,
        effect.offset.y,
        sigma,
        sigma,
        color,
        morphology
      )
    : r.getCachedDropShadow(effect.offset.x, effect.offset.y, sigma, color)
  // The layer copies the paint, so the shared one is reset at once for whatever draws inside.
  const paint = r.effectLayerPaint
  paint.setImageFilter(filter)
  setPaintBlendMode(r, paint, blendMode)
  canvas.saveLayer(paint, bounds)
  paint.setImageFilter(null)
  paint.setBlendMode(ck.BlendMode.SrcOver)
  try {
    draw()
  } finally {
    canvas.restore()
    if (morphology) {
      filter?.delete()
      morphology.delete()
    }
  }
}

function drawKnockout(r: SkiaRenderer, canvas: Canvas, bounds: Float32Array, draw: () => void) {
  const paint = r.effectLayerPaint
  paint.setBlendMode(r.ck.BlendMode.DstOut)
  canvas.saveLayer(paint, bounds)
  paint.setBlendMode(r.ck.BlendMode.SrcOver)
  try {
    draw()
  } finally {
    canvas.restore()
  }
}

/**
 * Draws a shadow cast by the node's own outline without a layer, when that outline is a shape
 * grown by its stroke; false when the node needs its silhouette drawn instead.
 */
function drawOwnShapeDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: Effect,
  spread: number,
  blendMode: BlendMode | undefined,
  knockout: boolean
): boolean {
  const outline = regularStrokeOutline(node, spread)
  if (!outline && !castsFromOwnShape(node)) return false
  const castsFill = fillsCastShadow(node)
  canvas.save()
  try {
    if (knockout) clipOutShapeKnockout(r, canvas, node, outline)
    if (castsFill && outline && strokeGrowsOutline(outline)) {
      drawOutlineDropShadow(r, canvas, node, effect, outline, spread, blendMode)
    } else if (castsFill) {
      drawShapeDropShadow(r, canvas, node, effect, spread, blendMode)
    } else if (outline) {
      drawRingDropShadow(r, canvas, node, effect, outline, spread, blendMode)
    }
  } finally {
    canvas.restore()
  }
  return true
}

/**
 * How far apart a container's children must be for their shadows to reach neither each other nor
 * another child: the blur's reach from both, any spread, and the offset.
 */
function shadowGap(effect: Effect, spread: number): number {
  const reach = 3 * blurSigma(effect.radius) + Math.abs(spread) + 1
  return 2 * reach + Math.hypot(effect.offset.x, effect.offset.y)
}

/**
 * Draws a shadow cast by `child`, in its parent's coordinates. The parent's effect is drawn in the
 * child's own space, so its offset is turned back by the child's rotation and flips; blur and
 * spread are the same in every direction.
 */
function withChildCoordinates<T>(
  canvas: Canvas,
  child: SceneNode,
  effect: Effect,
  draw: (local: Effect) => T
): T {
  const orientation = nodeOrientationMatrix(child)
  const inverse = Matrix.invert(orientation) ?? Matrix.identity()
  const origin = Matrix.mapPoint(inverse, { x: 0, y: 0 })
  const offset = Matrix.mapPoint(inverse, effect.offset)
  canvas.save()
  try {
    canvas.translate(child.x, child.y)
    canvas.concat(orientation)
    return draw({ ...effect, offset: { x: offset.x - origin.x, y: offset.y - origin.y } })
  } finally {
    canvas.restore()
  }
}

function renderDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  effect: Effect,
  includeChildren: boolean
): void {
  if (!includeChildren && !paintsCastShadow(node)) return
  const spread = shadowSpread(node, effect)
  const blendMode = effect.blendMode
  const knockout =
    effect.showShadowBehindNode === false && !paintsOverKnockout(graph, node, includeChildren)
  const children = includeChildren
    ? separateShadowChildren(graph, node, shadowGap(effect, spread))
    : null
  if (children?.every((child) => castsOwnShapeDropShadow(child, spread))) {
    for (const child of children) {
      withChildCoordinates(canvas, child, effect, (local) =>
        drawOwnShapeDropShadow(r, canvas, child, local, spread, blendMode, knockout)
      )
    }
    return
  }
  if (
    !includeChildren &&
    drawOwnShapeDropShadow(r, canvas, node, effect, spread, blendMode, knockout)
  ) {
    return
  }

  const bounds = shadowLayerBounds(r, graph, node, effect, spread, includeChildren)
  if (knockout) {
    setPaintBlendMode(r, r.effectLayerPaint, blendMode)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    setPaintBlendMode(r, r.effectLayerPaint, 'NORMAL')
  }
  try {
    drawSilhouetteDropShadow(
      r,
      canvas,
      effect,
      spread,
      bounds,
      knockout ? 'NORMAL' : blendMode,
      () => drawSilhouette(r, canvas, graph, node, 'cast', includeChildren)
    )
    if (knockout) {
      drawKnockout(r, canvas, bounds, () =>
        drawSilhouette(r, canvas, graph, node, 'knockout', includeChildren)
      )
    }
  } finally {
    if (knockout) canvas.restore()
    resetEffectLayerPaint(r)
  }
}

/** Draws an inner shadow inside whatever `draw` paints, cut from an offset, blurred inverse of it. */
function drawSilhouetteInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  effect: Effect,
  bounds: Float32Array,
  draw: () => void
): void {
  const ck = r.ck

  resetEffectLayerPaint(r)
  let restoreCount = 0
  let tintFilter: ReturnType<typeof ck.ColorFilter.MakeBlend> | null = null
  let solidBlackFilter: ReturnType<typeof ck.ColorFilter.MakeBlend> | null = null

  try {
    setPaintBlendMode(r, r.effectLayerPaint, effect.blendMode)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++
    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
    draw()

    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcIn)
    tintFilter = ck.ColorFilter.MakeBlend(
      ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
      ck.BlendMode.SrcIn
    )
    r.effectLayerPaint.setColorFilter(tintFilter)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++

    canvas.save()
    restoreCount++
    canvas.translate(effect.offset.x, effect.offset.y)

    // The inverse is drawn in offset coordinates, so it covers `bounds` once shifted back.
    const { x: dx, y: dy } = effect.offset
    const inverse = ck.LTRBRect(bounds[0] - dx, bounds[1] - dy, bounds[2] - dx, bounds[3] - dy)
    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setImageFilter(r.getCachedDecalBlur(blurSigma(effect.radius)))
    canvas.saveLayer(r.effectLayerPaint, inverse)
    restoreCount++

    r.auxFill.setColorComponents(0, 0, 0, 1)
    canvas.drawRect(inverse, r.auxFill)

    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setBlendMode(ck.BlendMode.DstOut)
    solidBlackFilter = ck.ColorFilter.MakeBlend(ck.Color4f(0, 0, 0, 1), ck.BlendMode.SrcIn)
    r.effectLayerPaint.setColorFilter(solidBlackFilter)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++
    draw()
  } finally {
    while (restoreCount > 0) {
      canvas.restore()
      restoreCount--
    }
    r.effectLayerPaint.setColorFilter(null)
    if (solidBlackFilter) solidBlackFilter.delete()
    if (tintFilter) tintFilter.delete()
    resetEffectLayerPaint(r)
  }
}

function renderInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  effect: Effect,
  includeChildren: boolean
): void {
  if (!includeChildren && !paintsCastShadow(node)) return
  const children = includeChildren
    ? separateShadowChildren(graph, node, shadowGap(effect, 0))
    : null
  if (children?.every(castsFromOwnShape)) {
    for (const child of children) {
      withChildCoordinates(canvas, child, effect, (local) =>
        drawShapeInnerShadow(r, canvas, child, local, innerShadowSpread(child, local))
      )
    }
    return
  }
  if (!includeChildren && castsFromOwnShape(node)) {
    const spread = innerShadowSpread(node, effect)
    drawShapeInnerShadow(r, canvas, node, effect, spread, isolatesInnerShadows(node))
    return
  }
  const bounds = shadowLayerBounds(r, graph, node, effect, 0, includeChildren)
  drawSilhouetteInnerShadow(r, canvas, effect, bounds, () =>
    drawSilhouette(r, canvas, graph, node, 'cast', includeChildren)
  )
}

/**
 * Whether a shape draws its fills and inner shadows in a layer of their own. There each shadow
 * replaces the fill under it before taking the shape's outline, so the antialiased edge applies
 * once, as in Figma, rather than letting the fill show through. Blended fills and shadows mix with
 * what lies under the shape, so they keep drawing in place.
 */
export function isolatesInnerShadows(node: SceneNode): boolean {
  if (isLayerContainer(node) || !castsFromOwnShape(node)) return false
  const shadows = node.effects.filter((effect) => effect.visible && effect.type === 'INNER_SHADOW')
  return (
    shadows.length > 0 &&
    shadows.every((effect) => !needsIsolatedBlendLayer(effect.blendMode)) &&
    [...node.fills, ...regionFills(node.vectorNetwork)].every(
      (fill) => !fill.visible || !needsIsolatedBlendLayer(fill.blendMode)
    )
  )
}

/**
 * Draws a shape's own effects. Frames, groups, and other containers take their shadows from
 * `renderLayerShadows` instead, because Figma casts them from the children as well.
 */
export function renderEffects(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  graph: SceneGraph,
  pass: EffectPass
): void {
  if (pass === 'front') renderNoiseEffects(r, canvas, node)

  const ownShadows = !isLayerContainer(node)
  for (const effect of node.effects) {
    if (!effect.visible) continue

    if (pass === 'behind' && effect.type === 'DROP_SHADOW' && ownShadows) {
      renderDropShadow(r, canvas, graph, node, effect, false)
    }

    if (pass === 'behind' && effect.type === 'BACKGROUND_BLUR') {
      const shape =
        node.type === 'BOOLEAN_OPERATION' ? makeBooleanOperationPath(r, node, graph) : null
      r.applyClippedBlur(canvas, node, blurSigma(effect.radius), shape)
      shape?.delete()
    }

    if (pass === 'inner' && effect.type === 'INNER_SHADOW' && ownShadows) {
      renderInnerShadow(r, canvas, graph, node, effect, false)
    }
  }
}

/**
 * Draws a container's drop shadows before it (`behind`) and its inner shadows over its fills,
 * strokes, and children (`front`), cast from the children too unless its own fill covers them.
 */
export function renderLayerShadows(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  pass: 'behind' | 'front'
): void {
  if (!isLayerContainer(node)) return
  const type = pass === 'behind' ? 'DROP_SHADOW' : 'INNER_SHADOW'
  const effects = node.effects.filter((effect) => effect.visible && effect.type === type)
  if (effects.length === 0) return
  const includeChildren = shadowIncludesChildren(graph, node)
  for (const effect of effects) {
    if (pass === 'behind') renderDropShadow(r, canvas, graph, node, effect, includeChildren)
    else renderInnerShadow(r, canvas, graph, node, effect, includeChildren)
  }
}
