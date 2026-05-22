import type { Canvas, Path } from 'canvaskit-wasm'

import type { Effect, SceneNode, ShadowEffect } from '#core/scene-graph'

import type { SkiaRenderer } from './renderer'
import { makeNodeShapePath, nodeHasRadius } from './shapes'

function drawChildTransform(canvas: Canvas, child: SceneNode, offset = { x: 0, y: 0 }): void {
  canvas.translate(child.x + offset.x, child.y + offset.y)
  if (child.rotation !== 0) {
    canvas.rotate(child.rotation, child.width / 2, child.height / 2)
  }
  if (child.flipX || child.flipY) {
    canvas.translate(child.flipX ? child.width : 0, child.flipY ? child.height : 0)
    canvas.scale(child.flipX ? -1 : 1, child.flipY ? -1 : 1)
  }
}

/**
 * Punch out the node's base shape from the shadow layer using DstOut blend mode.
 * Called when showShadowBehindNode is false to hide the shadow behind the node shape.
 * Draws the node's base shape (before offset/spread) as a DstOut mask.
 */
function punchOutShadowBehindNode(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: ShadowEffect,
  shapeNode: SceneNode,
  shapeHasRadius: boolean,
  geometryShadow: Path[] | null
): void {
  r.auxFill.setMaskFilter(null)
  r.auxFill.setColor(r.ck.BLACK)
  r.auxFill.setBlendMode(r.ck.BlendMode.DstOut)
  canvas.save()
  canvas.translate(-effect.offset.x, -effect.offset.y)

  if (geometryShadow) {
    const fillGeometry = r.getFillGeometry(node)
    if (fillGeometry) {
      for (const path of fillGeometry) canvas.drawPath(path, r.auxFill)
    }
  } else if (shapeNode.type === 'ELLIPSE') {
    canvas.drawOval(r.ltrb(0, 0, shapeNode.width, shapeNode.height), r.auxFill)
  } else if (isPathShape(shapeNode)) {
    const shapePath = makeNodeShapePath(
      r,
      shapeNode,
      r.ltrb(0, 0, shapeNode.width, shapeNode.height),
      shapeHasRadius
    )
    try {
      canvas.drawPath(shapePath, r.auxFill)
    } finally {
      shapePath.delete()
    }
  } else if (shapeHasRadius) {
    canvas.drawRRect(r.makeRRect(shapeNode), r.auxFill)
  } else {
    canvas.drawRect(r.ltrb(0, 0, shapeNode.width, shapeNode.height), r.auxFill)
  }

  canvas.restore()
  r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
}

function localEffectOffset(effect: Effect, child?: SceneNode | null) {
  const isShadow = effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
  let x = isShadow ? effect.offset.x : 0
  let y = isShadow ? effect.offset.y : 0
  if (!child) return { x, y }

  if (child.rotation !== 0) {
    const rad = (-child.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const nx = x * cos - y * sin
    const ny = x * sin + y * cos
    x = nx
    y = ny
  }
  if (child.flipX) x = -x
  if (child.flipY) y = -y
  return { x, y }
}

/** Whether the node type requires a Path-based shape (not a simple rect/oval/rrect). */
function isPathShape(node: SceneNode): boolean {
  return node.type === 'POLYGON' || node.type === 'STAR' || node.type === 'VECTOR'
}

/**
 * Apply spread to a closed shape path via Path.stroke() + PathOp.
 * Mutates `target` in place to the expanded/contracted result.
 *
 * For positive spread: Union of target + stroke ring = expanded outline.
 * For negative spread: Difference of target - stroke ring = contracted interior.
 * For zero spread: no-op.
 *
 * Returns true if the operation succeeded, false if it failed (target unchanged).
 */
function applySpreadToPath(ck: SkiaRenderer['ck'], target: Path, spread: number): boolean {
  if (spread === 0) return true

  // .copy() allocates a new WASM Path — must be deleted even if .stroke() throws.
  const copy = target.copy()
  try {
    // stroke() mutates the copy in-place and returns it (or null on failure).
    const ring = copy.stroke({ width: Math.abs(spread) * 2, join: ck.StrokeJoin.Round })
    if (!ring) return false

    if (spread > 0) {
      // Union: target + ring = expanded shape
      target.op(ring, ck.PathOp.Union)
    } else {
      // Difference: target - ring = contracted shape
      target.op(ring, ck.PathOp.Difference)
    }
    return true
  } catch {
    return false
  } finally {
    copy.delete()
  }
}

/**
 * Draw the shadow shape with spread applied. For geometryShadow paths (filled/stroked nodes),
 * copies are made and spread is applied to avoid mutating cached geometries.
 * For other shapes, spread is applied inline via drawing APIs.
 */
function drawShadowShape(
  r: SkiaRenderer,
  canvas: Canvas,
  shapeNode: SceneNode,
  sp: number,
  shapeHasRadius: boolean,
  geometryShadow: Path[] | null
): void {
  if (geometryShadow) {
    // Copy cached geometry paths before applying spread — the caches (fillGeometryCache,
    // strokeGeometryCache) own the original paths and must not be mutated.
    const pathsToDraw: Path[] = []
    for (const path of geometryShadow) {
      const copy = path.copy()
      if (sp !== 0) applySpreadToPath(r.ck, copy, sp)
      pathsToDraw.push(copy)
    }
    try {
      for (const p of pathsToDraw) canvas.drawPath(p, r.auxFill)
    } finally {
      for (const p of pathsToDraw) p.delete()
    }
  } else if (shapeNode.type === 'ELLIPSE') {
    canvas.drawOval(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
  } else if (isPathShape(shapeNode)) {
    // POLYGON/STAR/VECTOR may lack fillGeometry (programmatic nodes).
    // Build the shape path from vertex data and apply spread via Path.stroke() + PathOp.
    const shapePath = makeNodeShapePath(
      r,
      shapeNode,
      r.ltrb(0, 0, shapeNode.width, shapeNode.height),
      shapeHasRadius
    )
    try {
      applySpreadToPath(r.ck, shapePath, sp)
      canvas.drawPath(shapePath, r.auxFill)
    } finally {
      shapePath.delete()
    }
  } else if (shapeHasRadius) {
    canvas.drawRRect(r.makeRRectWithSpread(shapeNode, sp), r.auxFill)
  } else {
    canvas.drawRect(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
  }
}

function drawShapeDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: ShadowEffect,
  hasRadius: boolean,
  shadowShapeChild?: SceneNode | null
): void {
  const sp = effect.spread ?? 0
  const shapeNode = shadowShapeChild ?? node
  const shapeHasRadius = shadowShapeChild ? nodeHasRadius(shadowShapeChild) : hasRadius
  const hasVisibleFill = node.fills.some((fill) => fill.visible)
  let geometryShadow: Path[] | null = null
  if (!shadowShapeChild) {
    if (hasVisibleFill) {
      geometryShadow = r.getFillGeometry(node)
    } else if (node.strokeGeometry.length > 0) {
      geometryShadow = r.getStrokeGeometry(node)
    }
  }

  r.auxFill.setColor(r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a))
  r.auxFill.setMaskFilter(r.getCachedMaskBlur(effect.radius / 2))
  r.auxFill.setImageFilter(null)
  canvas.save()

  if (shadowShapeChild) drawChildTransform(canvas, shadowShapeChild, effect.offset)
  else canvas.translate(effect.offset.x, effect.offset.y)

  const shouldHideShadowBehindUnfilledNode =
    effect.showShadowBehindNode === false && !hasVisibleFill && !shadowShapeChild
  if (shouldHideShadowBehindUnfilledNode) {
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    canvas.saveLayer(r.effectLayerPaint)
  }

  // Draw the shadow shape with spread applied.
  drawShadowShape(r, canvas, shapeNode, sp, shapeHasRadius, geometryShadow)

  // Unified punch-out pass: when showShadowBehindNode is false, hide the shadow behind
  // the node's base shape (before offset/spread). Works for ALL shape types.
  if (shouldHideShadowBehindUnfilledNode) {
    punchOutShadowBehindNode(r, canvas, node, effect, shapeNode, shapeHasRadius, geometryShadow)
  }

  if (shouldHideShadowBehindUnfilledNode) {
    canvas.restore()
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
  }
  canvas.restore()
  r.auxFill.setMaskFilter(null)
  r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
}

function renderDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: ShadowEffect,
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

  const shadowColor = r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
  const dropFilter = r.getCachedDropShadow(0, 0, effect.radius / 2, shadowColor)

  canvas.save()
  if (shadowShapeChild) drawChildTransform(canvas, shadowShapeChild, effect.offset)
  else canvas.translate(effect.offset.x, effect.offset.y)

  r.effectLayerPaint.setImageFilter(dropFilter)
  canvas.saveLayer(r.effectLayerPaint)
  try {
    r.renderText(canvas, shapeNode)
  } finally {
    canvas.restore()
    // Exit guard: ensure shared paint is in clean state
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    canvas.restore()
  }
}

function drawTextInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  _node: SceneNode,
  effect: ShadowEffect,
  shadowShapeChild?: SceneNode | null
): void {
  const shapeNode = shadowShapeChild ?? _node
  const ck = r.ck

  // Entry guard: reset shared paint to known state (also serves as Master Layer paint state)
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)

  // Native ColorFilter objects — declared outside try so finally can clean up.
  // Initialized to null and assigned when allocated in the try block.
  let tintFilter: ReturnType<typeof ck.ColorFilter.MakeBlend> | null = null
  let solidBlackFilter: ReturnType<typeof ck.ColorFilter.MakeBlend> | null = null

  // Track how many canvas saves we've pushed inside the try block.
  // On the happy path, all are restored before the try block ends,
  // so innerSaves == 0. On the exception path, innerSaves > 0 and
  // the finally block restores them to prevent canvas stack corruption.
  let innerSaves = 0

  // Track whether the Child Transform save was pushed so the finally
  // block can restore it on any exception path.
  let childTransformSaved = false

  try {
    canvas.save()
    childTransformSaved = true
    if (shadowShapeChild) {
      drawChildTransform(canvas, shadowShapeChild)
    }

    // 1. Establish Master Layer: Isolates the entire shadow composition
    canvas.saveLayer(r.effectLayerPaint)
    innerSaves++

    // 2. Draw original text (M) as clipping mask.
    //    fillPaint is NOT mutated — the SrcIn layer clips by alpha regardless of color.
    r.renderText(canvas, shapeNode)

    // 3. Restrictive Layer: Clip to text glyphs, tint to shadow color.
    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcIn)
    tintFilter = ck.ColorFilter.MakeBlend(
      r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
      ck.BlendMode.SrcIn
    )
    r.effectLayerPaint.setColorFilter(tintFilter)
    canvas.saveLayer(r.effectLayerPaint)
    innerSaves++

    // 4. Calculate local offset for parent-space parity
    const { x: localOffsetX, y: localOffsetY } = localEffectOffset(effect, shadowShapeChild)

    // 5. Apply Transform: Move the canvas by the local offset
    canvas.save()
    innerSaves++
    canvas.translate(localOffsetX, localOffsetY)

    // 6. Blur Layer: Blurs the negative space we are about to create
    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setImageFilter(r.getCachedDecalBlur(effect.radius / 2))
    canvas.saveLayer(r.effectLayerPaint)
    innerSaves++

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
    solidBlackFilter = ck.ColorFilter.MakeBlend(ck.Color4f(0, 0, 0, 1), ck.BlendMode.SrcIn)
    r.effectLayerPaint.setColorFilter(solidBlackFilter)
    canvas.saveLayer(r.effectLayerPaint)
    innerSaves++

    r.renderText(canvas, shapeNode)

    // 9. Collapse and cleanup
    canvas.restore() // Pops DstOut
    innerSaves--
    canvas.restore() // Pops Blur
    innerSaves--
    canvas.restore() // Pops Transform
    innerSaves--
    canvas.restore() // Pops SrcIn
    innerSaves--
    canvas.restore() // Pops Master Layer
    innerSaves--
  } finally {
    // Restore any inner saves that weren't popped on the exception path.
    // This prevents canvas stack corruption that would cascade up the
    // render tree (every un-restored save shifts all subsequent restores
    // to the wrong layer, causing visual corruption).
    while (innerSaves > 0) {
      canvas.restore()
      innerSaves--
    }

    // Clean up native ColorFilter objects regardless of exceptions.
    // Detach from paint before deletion to prevent use-after-free.
    r.effectLayerPaint.setColorFilter(null)
    if (solidBlackFilter) solidBlackFilter.delete()
    if (tintFilter) tintFilter.delete()

    if (childTransformSaved) canvas.restore() // Pops Child Transform

    // Exit guard: ensure shared paint is in clean state (consistent with other effect functions)
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
  }
}

function drawShapeInnerShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  effect: ShadowEffect,
  hasRadius: boolean,
  shadowShapeChild?: SceneNode | null
): void {
  const sp = effect.spread ?? 0
  const shapeNode = shadowShapeChild ?? node
  const ck = r.ck
  r.auxFill.setColor(r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a))
  r.auxFill.setImageFilter(r.getCachedDecalBlur(effect.radius / 2))

  const shapeRect = shadowShapeChild ? ck.LTRBRect(0, 0, shapeNode.width, shapeNode.height) : rect
  const shapeHasRadius = shadowShapeChild ? nodeHasRadius(shadowShapeChild) : hasRadius

  canvas.save()
  if (shadowShapeChild) {
    drawChildTransform(canvas, shadowShapeChild)
  }

  // Clip to the actual shape outline so the inner shadow stays within bounds.
  if (shapeNode.type === 'ELLIPSE') {
    const clipPath = new ck.Path()
    try {
      clipPath.addOval(shapeRect)
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)
    } finally {
      clipPath.delete()
    }
  } else if (isPathShape(shapeNode)) {
    const clipPath = makeNodeShapePath(r, shapeNode, shapeRect, shapeHasRadius)
    try {
      canvas.clipPath(clipPath, ck.ClipOp.Intersect, true)
    } finally {
      clipPath.delete()
    }
  } else if (shapeHasRadius) {
    canvas.clipRRect(r.makeRRect(shapeNode), ck.ClipOp.Intersect, true)
  } else {
    canvas.clipRect(shapeRect, ck.ClipOp.Intersect, true)
  }

  const expand = effect.radius * 2
  const { x: localOffsetX, y: localOffsetY } = localEffectOffset(effect, shadowShapeChild)

  const spreadPadding = sp < 0 ? -sp : 0
  const big = ck.LTRBRect(
    Math.min(-expand, -expand + localOffsetX - spreadPadding),
    Math.min(-expand, -expand + localOffsetY - spreadPadding),
    Math.max(shapeNode.width + expand, shapeNode.width + expand + localOffsetX + spreadPadding),
    Math.max(shapeNode.height + expand, shapeNode.height + expand + localOffsetY + spreadPadding)
  )
  const bigPath = new ck.Path()
  bigPath.addRect(big)
  try {
    // Build the inner path (the shape offset by the shadow direction, contracted by spread).
    // The inner shadow is rendered as: big rect MINUS inner path.
    if (shapeNode.type === 'ELLIPSE') {
      const innerPath = new ck.Path()
      try {
        const offsetRect = ck.LTRBRect(
          localOffsetX + sp,
          localOffsetY + sp,
          shapeNode.width + localOffsetX - sp,
          shapeNode.height + localOffsetY - sp
        )
        innerPath.addOval(offsetRect)
        bigPath.op(innerPath, ck.PathOp.Difference)
      } finally {
        innerPath.delete()
      }
    } else if (isPathShape(shapeNode)) {
      // POLYGON/STAR/VECTOR: build shape path, offset it, contract by spread.
      const innerPath = makeNodeShapePath(r, shapeNode, shapeRect, shapeHasRadius)
      try {
        // Apply the shadow offset transform to the path
        innerPath.transform(ck.Matrix.translated(localOffsetX, localOffsetY))
        // Contract by spread: remove the sp-wide edge band from the path
        applySpreadToPath(ck, innerPath, -sp)
        bigPath.op(innerPath, ck.PathOp.Difference)
      } finally {
        innerPath.delete()
      }
    } else if (shapeHasRadius) {
      const innerPath = new ck.Path()
      try {
        innerPath.addRRect(r.makeRRectWithOffset(shapeNode, localOffsetX, localOffsetY, sp))
        bigPath.op(innerPath, ck.PathOp.Difference)
      } finally {
        innerPath.delete()
      }
    } else {
      const innerPath = new ck.Path()
      try {
        innerPath.addRect(
          ck.LTRBRect(
            localOffsetX + sp,
            localOffsetY + sp,
            shapeNode.width + localOffsetX - sp,
            shapeNode.height + localOffsetY - sp
          )
        )
        bigPath.op(innerPath, ck.PathOp.Difference)
      } finally {
        innerPath.delete()
      }
    }
    canvas.drawPath(bigPath, r.auxFill)
  } finally {
    bigPath.delete()
  }
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
