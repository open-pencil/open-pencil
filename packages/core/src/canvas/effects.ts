import type { SceneNode } from '#core/scene-graph'
import type { SkiaRenderer } from './renderer'
import type { Canvas, ImageFilter, MaskFilter } from 'canvaskit-wasm'

export function getCachedDropShadow(
  r: SkiaRenderer,
  dx: number,
  dy: number,
  sigma: number,
  color: Float32Array
): ImageFilter {
  const key = `ds:${dx},${dy},${sigma},${color[0]},${color[1]},${color[2]},${color[3]}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeDropShadowOnly(dx, dy, sigma, sigma, color, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const key = `blur:${sigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Clamp, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedDecalBlur(r: SkiaRenderer, sigma: number): ImageFilter {
  const key = `dblur:${sigma}`
  let filter = r.imageFilterCache.get(key)
  if (!filter) {
    filter = r.ck.ImageFilter.MakeBlur(sigma, sigma, r.ck.TileMode.Decal, null)
    r.imageFilterCache.set(key, filter)
  }
  return filter
}

export function getCachedMaskBlur(r: SkiaRenderer, sigma: number): MaskFilter {
  let filter = r.maskFilterCache.get(sigma)
  if (!filter) {
    filter = r.ck.MaskFilter.MakeBlur(r.ck.BlurStyle.Normal, sigma, true)
    r.maskFilterCache.set(sigma, filter)
  }
  return filter
}

export function applyClippedBlur(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  sigma: number
): void {
  canvas.save()
  r.clipNodeShape(canvas, node, rect, hasRadius)
  r.effectLayerPaint.setImageFilter(r.getCachedBlur(sigma))
  canvas.saveLayer(r.effectLayerPaint)
  canvas.restore()
  canvas.restore()
}

export function nodeHasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

function drawShapeDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: SceneNode['effects'][number],
  hasRadius: boolean,
  shadowShapeChild?: SceneNode | null
): void {
  const sp = effect.spread
  const shapeNode = shadowShapeChild ?? node
  const shapeHasRadius = shadowShapeChild ? nodeHasRadius(shadowShapeChild) : hasRadius
  const strokeShadow =
    !shadowShapeChild && !node.fills.some((fill) => fill.visible) && node.strokeGeometry.length > 0
      ? r.getStrokeGeometry(node)
      : null

  r.auxFill.setColor(r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a))
  r.auxFill.setMaskFilter(r.getCachedMaskBlur(effect.radius / 2))
  r.auxFill.setImageFilter(null)
  canvas.save()
  canvas.translate(
    effect.offset.x + (shadowShapeChild?.x ?? 0),
    effect.offset.y + (shadowShapeChild?.y ?? 0)
  )
  if (strokeShadow) {
    for (const path of strokeShadow) canvas.drawPath(path, r.auxFill)
  } else if (shapeNode.type === 'ELLIPSE') {
    canvas.drawOval(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
  } else if (shapeHasRadius) {
    canvas.drawRRect(r.makeRRectWithSpread(shapeNode, sp), r.auxFill)
  } else {
    canvas.drawRect(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
  }
  canvas.restore()
  r.auxFill.setMaskFilter(null)
}

function renderDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: SceneNode['effects'][number],
  hasRadius: boolean,
  shadowShapeChild?: SceneNode | null
): void {
  if (node.type !== 'TEXT') {
    drawShapeDropShadow(r, canvas, node, effect, hasRadius, shadowShapeChild)
    return
  }

  const shadowColor = r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
  const dropFilter = r.getCachedDropShadow(
    effect.offset.x,
    effect.offset.y,
    effect.radius / 2,
    shadowColor
  )
  r.effectLayerPaint.setImageFilter(dropFilter)
  canvas.saveLayer(r.effectLayerPaint)
  r.renderText(canvas, node)
  canvas.restore()
}

export function renderEffects(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  pass: 'behind' | 'front',
  shadowShapeChild?: SceneNode | null
): void {
  for (const effect of node.effects) {
    if (!effect.visible) continue

    if (pass === 'behind' && effect.type === 'DROP_SHADOW') {
      renderDropShadow(r, canvas, node, effect, hasRadius, shadowShapeChild)
    }

    if (pass === 'behind' && effect.type === 'BACKGROUND_BLUR') {
      r.applyClippedBlur(canvas, node, rect, hasRadius, effect.radius / 2)
    }

    if (pass === 'front' && effect.type === 'INNER_SHADOW') {
      if (node.type === 'TEXT') {
        r.effectLayerPaint.setImageFilter(r.getCachedDecalBlur(effect.radius))
        r.effectLayerPaint.setColorFilter(
          r.ck.ColorFilter.MakeBlend(
            r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
            r.ck.BlendMode.SrcIn
          )
        )
        canvas.saveLayer(r.effectLayerPaint)
        canvas.save()
        canvas.translate(effect.offset.x, effect.offset.y)
        r.renderText(canvas, node)
        canvas.restore()
        canvas.restore()
        r.effectLayerPaint.setColorFilter(null)
        continue
      }
      const sp = effect.spread
      r.auxFill.setColor(
        r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
      )
      r.auxFill.setImageFilter(r.getCachedDecalBlur(effect.radius))

      canvas.save()
      r.clipNodeShape(canvas, node, rect, hasRadius)

      const expand = effect.radius * 2
      const big = r.ck.LTRBRect(
        -expand + effect.offset.x,
        -expand + effect.offset.y,
        node.width + expand + effect.offset.x,
        node.height + expand + effect.offset.y
      )
      const bigPath = new r.ck.Path()
      bigPath.addRect(big)
      if (node.type === 'ELLIPSE') {
        const innerPath = new r.ck.Path()
        const offsetRect = r.ck.LTRBRect(
          effect.offset.x + sp,
          effect.offset.y + sp,
          node.width + effect.offset.x - sp,
          node.height + effect.offset.y - sp
        )
        innerPath.addOval(offsetRect)
        bigPath.op(innerPath, r.ck.PathOp.Difference)
        innerPath.delete()
      } else if (hasRadius) {
        const innerPath = new r.ck.Path()
        innerPath.addRRect(
          r.makeRRectWithOffset(node, effect.offset.x + sp, effect.offset.y + sp, -sp)
        )
        bigPath.op(innerPath, r.ck.PathOp.Difference)
        innerPath.delete()
      } else {
        const innerPath = new r.ck.Path()
        innerPath.addRect(
          r.ck.LTRBRect(
            effect.offset.x + sp,
            effect.offset.y + sp,
            node.width + effect.offset.x - sp,
            node.height + effect.offset.y - sp
          )
        )
        bigPath.op(innerPath, r.ck.PathOp.Difference)
        innerPath.delete()
      }
      canvas.drawPath(bigPath, r.auxFill)
      bigPath.delete()
      canvas.restore()
      r.auxFill.setImageFilter(null)
    }
  }
}
