import { nodeHasRadius } from './shapes'

import type { SceneNode } from '#core/scene-graph'
import type { SkiaRenderer } from './renderer'
import type { Canvas } from 'canvaskit-wasm'

function drawChildTransform(canvas: Canvas, child: SceneNode): void {
  canvas.translate(child.x, child.y)
  if (child.rotation !== 0) {
    canvas.rotate(child.rotation, child.width / 2, child.height / 2)
  }
  if (child.flipX || child.flipY) {
    canvas.translate(child.flipX ? child.width : 0, child.flipY ? child.height : 0)
    canvas.scale(child.flipX ? -1 : 1, child.flipY ? -1 : 1)
  }
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

  if (shadowShapeChild) {
    canvas.translate(shadowShapeChild.x + effect.offset.x, shadowShapeChild.y + effect.offset.y)
    if (shadowShapeChild.rotation !== 0) {
      canvas.rotate(
        shadowShapeChild.rotation,
        shadowShapeChild.width / 2,
        shadowShapeChild.height / 2
      )
    }
    if (shadowShapeChild.flipX || shadowShapeChild.flipY) {
      canvas.translate(
        shadowShapeChild.flipX ? shadowShapeChild.width : 0,
        shadowShapeChild.flipY ? shadowShapeChild.height : 0
      )
      canvas.scale(shadowShapeChild.flipX ? -1 : 1, shadowShapeChild.flipY ? -1 : 1)
    }
  } else {
    canvas.translate(effect.offset.x, effect.offset.y)
  }

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
  // Entry guard: reset shared paint to known state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)

  const shapeNode = shadowShapeChild ?? node
  if (shapeNode.type !== 'TEXT') {
    drawShapeDropShadow(r, canvas, node, effect, hasRadius, shadowShapeChild)
    // Exit guard: paint was not mutated by drawShapeDropShadow, but reset for consistency
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    return
  }

  const shadowColor = r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
  const dropFilter = r.getCachedDropShadow(0, 0, effect.radius / 2, shadowColor)

  canvas.save()
  if (shadowShapeChild) {
    canvas.translate(shadowShapeChild.x + effect.offset.x, shadowShapeChild.y + effect.offset.y)
    if (shadowShapeChild.rotation !== 0) {
      canvas.rotate(
        shadowShapeChild.rotation,
        shadowShapeChild.width / 2,
        shadowShapeChild.height / 2
      )
    }
    if (shadowShapeChild.flipX || shadowShapeChild.flipY) {
      canvas.translate(
        shadowShapeChild.flipX ? shadowShapeChild.width : 0,
        shadowShapeChild.flipY ? shadowShapeChild.height : 0
      )
      canvas.scale(shadowShapeChild.flipX ? -1 : 1, shadowShapeChild.flipY ? -1 : 1)
    }
  } else {
    canvas.translate(effect.offset.x, effect.offset.y)
  }

  r.effectLayerPaint.setImageFilter(dropFilter)
  canvas.saveLayer(r.effectLayerPaint)
  r.renderText(canvas, shapeNode)
  canvas.restore()
  // Exit guard: ensure shared paint is in clean state
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  canvas.restore()
}

function drawTextInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  _node: SceneNode,
  effect: SceneNode['effects'][number],
  shadowShapeChild?: SceneNode | null
): void {
  const shapeNode = shadowShapeChild ?? _node
  const ck = r.ck

  // Entry guard: reset shared paint to known state (also serves as Master Layer paint state)
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)

  canvas.save()
  if (shadowShapeChild) {
    drawChildTransform(canvas, shadowShapeChild)
  }

  // 1. Establish Master Layer: Isolates the entire shadow composition
  canvas.saveLayer(r.effectLayerPaint)

  // 2. Draw original text (M) as clipping mask.
  //    fillPaint is NOT mutated — the SrcIn layer clips by alpha regardless of color.
  r.renderText(canvas, shapeNode)

  // 3. Restrictive Layer: Clip to text glyphs, tint to shadow color.
  r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcIn)
  const tintFilter = ck.ColorFilter.MakeBlend(
    ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
    ck.BlendMode.SrcIn
  )
  r.effectLayerPaint.setColorFilter(tintFilter)
  canvas.saveLayer(r.effectLayerPaint)

  // 4. Calculate local offset for parent-space parity
  let localOffsetX = effect.offset.x
  let localOffsetY = effect.offset.y
  if (shadowShapeChild) {
    if (shadowShapeChild.rotation !== 0) {
      const rad = (-shadowShapeChild.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const nx = localOffsetX * cos - localOffsetY * sin
      const ny = localOffsetX * sin + localOffsetY * cos
      localOffsetX = nx
      localOffsetY = ny
    }
    if (shadowShapeChild.flipX) localOffsetX = -localOffsetX
    if (shadowShapeChild.flipY) localOffsetY = -localOffsetY
  }

  // 5. Apply Transform: Move the canvas by the local offset
  canvas.save()
  canvas.translate(localOffsetX, localOffsetY)

  // 6. Blur Layer: Blurs the negative space we are about to create
  r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setImageFilter(r.getCachedDecalBlur(effect.radius / 2))
  canvas.saveLayer(r.effectLayerPaint)

  // 7. Build the base of (1 - M): A massive solid block.
  const expand = effect.radius * 2 + Math.max(Math.abs(localOffsetX), Math.abs(localOffsetY))
  const giantRect = ck.LTRBRect(
    -expand,
    -expand,
    shapeNode.width + expand,
    shapeNode.height + expand
  )
  r.auxFill.setColor(ck.Color4f(0, 0, 0, 1))
  canvas.drawRect(giantRect, r.auxFill)

  // 8. DstOut layer — punch text out of the block.
  //    ColorFilter on the layer paint forces renderText output to solid black
  //    without mutating fillPaint. Explicit .delete() fixes GAP-01 memory leak.
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setBlendMode(ck.BlendMode.DstOut)
  const solidBlackFilter = ck.ColorFilter.MakeBlend(ck.Color4f(0, 0, 0, 1), ck.BlendMode.SrcIn)
  r.effectLayerPaint.setColorFilter(solidBlackFilter)
  canvas.saveLayer(r.effectLayerPaint)

  r.renderText(canvas, shapeNode)

  // 9. Collapse and cleanup
  canvas.restore() // Pops DstOut
  r.effectLayerPaint.setColorFilter(null) // Detach filter before deletion (use-after-free guard)
  solidBlackFilter.delete()

  canvas.restore() // Pops Blur
  canvas.restore() // Pops Transform
  canvas.restore() // Pops SrcIn
  r.effectLayerPaint.setColorFilter(null) // Detach filter before deletion (use-after-free guard)
  tintFilter.delete()

  canvas.restore() // Pops Master Layer
  canvas.restore() // Pops Child Transform

  // Exit guard: ensure shared paint is in clean state (consistent with other effect functions)
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
}

function drawShapeInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  effect: SceneNode['effects'][number],
  hasRadius: boolean,
  shadowShapeChild?: SceneNode | null
): void {
  const sp = effect.spread
  const shapeNode = shadowShapeChild ?? node
  r.auxFill.setColor(r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a))
  r.auxFill.setImageFilter(r.getCachedDecalBlur(effect.radius / 2))

  const shapeRect = shadowShapeChild ? r.ck.LTRBRect(0, 0, shapeNode.width, shapeNode.height) : rect
  const shapeHasRadius = shadowShapeChild ? nodeHasRadius(shadowShapeChild) : hasRadius

  canvas.save()
  if (shadowShapeChild) {
    drawChildTransform(canvas, shadowShapeChild)
  }

  if (shapeNode.type === 'ELLIPSE') {
    const path = new r.ck.Path()
    path.addOval(shapeRect)
    canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
    path.delete()
  } else if (shapeHasRadius) {
    canvas.clipRRect(r.makeRRect(shapeNode), r.ck.ClipOp.Intersect, true)
  } else {
    canvas.clipRect(shapeRect, r.ck.ClipOp.Intersect, true)
  }

  const expand = effect.radius * 2
  let localOffsetX = effect.offset.x
  let localOffsetY = effect.offset.y
  if (shadowShapeChild) {
    if (shadowShapeChild.rotation !== 0) {
      const rad = (-shadowShapeChild.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const nx = localOffsetX * cos - localOffsetY * sin
      const ny = localOffsetX * sin + localOffsetY * cos
      localOffsetX = nx
      localOffsetY = ny
    }
    if (shadowShapeChild.flipX) localOffsetX = -localOffsetX
    if (shadowShapeChild.flipY) localOffsetY = -localOffsetY
  }

  const spreadPadding = sp < 0 ? -sp : 0
  const big = r.ck.LTRBRect(
    Math.min(-expand, -expand + localOffsetX - spreadPadding),
    Math.min(-expand, -expand + localOffsetY - spreadPadding),
    Math.max(shapeNode.width + expand, shapeNode.width + expand + localOffsetX + spreadPadding),
    Math.max(shapeNode.height + expand, shapeNode.height + expand + localOffsetY + spreadPadding)
  )
  const bigPath = new r.ck.Path()
  bigPath.addRect(big)
  if (shapeNode.type === 'ELLIPSE') {
    const innerPath = new r.ck.Path()
    const offsetRect = r.ck.LTRBRect(
      localOffsetX + sp,
      localOffsetY + sp,
      shapeNode.width + localOffsetX - sp,
      shapeNode.height + localOffsetY - sp
    )
    innerPath.addOval(offsetRect)
    bigPath.op(innerPath, r.ck.PathOp.Difference)
    innerPath.delete()
  } else if (shapeHasRadius) {
    const innerPath = new r.ck.Path()
    innerPath.addRRect(r.makeRRectWithOffset(shapeNode, localOffsetX, localOffsetY, sp))
    bigPath.op(innerPath, r.ck.PathOp.Difference)
    innerPath.delete()
  } else {
    const innerPath = new r.ck.Path()
    innerPath.addRect(
      r.ck.LTRBRect(
        localOffsetX + sp,
        localOffsetY + sp,
        shapeNode.width + localOffsetX - sp,
        shapeNode.height + localOffsetY - sp
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
      const shapeNode = shadowShapeChild ?? node
      if (shapeNode.type === 'TEXT') {
        drawTextInnerShadow(r, canvas, node, effect, shadowShapeChild)
      } else {
        drawShapeInnerShadow(r, canvas, node, rect, effect, hasRadius, shadowShapeChild)
      }
    }
  }
}
