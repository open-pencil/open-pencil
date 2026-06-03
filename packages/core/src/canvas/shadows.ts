import type { Canvas, Path } from 'canvaskit-wasm'

import { BLACK } from '#core/constants'
import type { SceneNode } from '#core/scene-graph'
import type { Color, Vector } from '#core/types'

import { figmaBlendModeToSkia } from './blend'
import type { SkiaRenderer } from './renderer'
import {
  makeNodeShapePath,
  makeSmoothRRectPath,
  nodeHasRadius,
  nodeHasSmoothCorners
} from './shapes'

const MAX_RAW_NOISE_CELLS = 12_000

interface RawNoiseEffect {
  type: 'NOISE'
  visible?: boolean
  color?: Color
  secondaryColor?: Color
  opacity?: number
  density?: number
  noiseSize?: Vector
  noiseType?: 'MONOTONE' | 'DUOTONE' | 'MULTITONE'
}

function resetEffectLayerPaint(r: SkiaRenderer): void {
  r.effectLayerPaint.setImageFilter(null)
  r.effectLayerPaint.setColorFilter(null)
  r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
}

function rawNoiseEffects(node: SceneNode): RawNoiseEffect[] {
  const source = (node as Partial<SceneNode>).source
  const effects = source?.fig.rawNodeFields.effects
  if (!Array.isArray(effects)) return []
  return effects.filter(
    (effect): effect is RawNoiseEffect =>
      effect !== null &&
      typeof effect === 'object' &&
      'type' in effect &&
      effect.type === 'NOISE' &&
      ('visible' in effect ? effect.visible !== false : true)
  )
}

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function renderNoiseEffect(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean,
  effect: RawNoiseEffect
): void {
  const density = Math.max(0, Math.min(1, effect.density ?? 0.3))
  const requestedStep = Math.max(2, Math.round((effect.noiseSize?.x ?? 0.5) * 8))
  const boundedStep = Math.ceil(Math.sqrt((node.width * node.height) / MAX_RAW_NOISE_CELLS))
  const step = Math.max(requestedStep, boundedStep)
  const color = effect.color ?? BLACK
  const opacity = effect.opacity ?? color.a
  const paint = new r.ck.Paint()
  try {
    paint.setAntiAlias(false)
    canvas.save()
    r.clipNodeShape(canvas, node, rect, hasRadius)
    for (let y = 0; y < node.height; y += step) {
      for (let x = 0; x < node.width; x += step) {
        const value = seededNoise((x + 1) * 73856093 + (y + 1) * 19349663)
        if (value > density) continue
        const alpha = Math.max(0, Math.min(1, opacity * (0.35 + value * 0.65)))
        paint.setColor(r.ck.Color4f(color.r, color.g, color.b, alpha))
        canvas.drawRect(
          r.ck.LTRBRect(x, y, Math.min(node.width, x + 1), Math.min(node.height, y + 1)),
          paint
        )
      }
    }
    canvas.restore()
  } finally {
    paint.delete()
  }
}

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

function localEffectOffset(effect: SceneNode['effects'][number], child?: SceneNode | null) {
  let x = effect.offset.x
  let y = effect.offset.y
  if (!child) return { x, y }

  const rotation = child.rotation
  if (rotation !== 0) {
    const rad = (-rotation * Math.PI) / 180
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

function isPathShape(node: SceneNode): boolean {
  return node.type === 'POLYGON' || node.type === 'STAR' || node.type === 'VECTOR'
}

function effectLayerBounds(
  r: SkiaRenderer,
  node: SceneNode,
  effect: SceneNode['effects'][number],
  extraPadding = 0
): Float32Array {
  const offset = effect.offset
  const padding = Math.max(effect.radius * 2, Math.abs(effect.spread)) + extraPadding
  return r.ck.LTRBRect(
    Math.min(0, offset.x) - padding,
    Math.min(0, offset.y) - padding,
    Math.max(node.width, node.width + offset.x) + padding,
    Math.max(node.height, node.height + offset.y) + padding
  )
}

function applySpreadToPath(r: SkiaRenderer, path: Path, spread: number): boolean {
  if (spread === 0) return true
  const ring = path.copy()
  try {
    if (!ring.stroke({ width: Math.abs(spread) * 2, join: r.ck.StrokeJoin.Round })) return false
    return path.op(ring, spread > 0 ? r.ck.PathOp.Union : r.ck.PathOp.Difference)
  } finally {
    ring.delete()
  }
}

function drawPathShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  hasRadius: boolean,
  spread = 0
): void {
  const path = makeNodeShapePath(r, node, r.ltrb(0, 0, node.width, node.height), hasRadius)
  try {
    applySpreadToPath(r, path, spread)
    canvas.drawPath(path, r.auxFill)
  } finally {
    path.delete()
  }
}

function drawShadowGeometryPath(r: SkiaRenderer, canvas: Canvas, path: Path, spread: number): void {
  if (spread === 0) {
    canvas.drawPath(path, r.auxFill)
    return
  }
  const copy = path.copy()
  try {
    applySpreadToPath(r, copy, spread)
    canvas.drawPath(copy, r.auxFill)
  } finally {
    copy.delete()
  }
}

function drawShadowCutout(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: SceneNode['effects'][number],
  shapeNode: SceneNode,
  shapeHasRadius: boolean,
  geometryShadow: Path[] | null
): void {
  r.auxFill.setMaskFilter(null)
  r.auxFill.setColor(r.ck.BLACK)
  r.auxFill.setBlendMode(r.ck.BlendMode.DstOut)
  canvas.save()
  try {
    canvas.translate(-effect.offset.x, -effect.offset.y)
    if (geometryShadow) {
      const fillGeometry = r.getFillGeometry(node)
      if (fillGeometry) for (const path of fillGeometry) canvas.drawPath(path, r.auxFill)
    } else if (shapeNode.type === 'ELLIPSE') {
      canvas.drawOval(r.ltrb(0, 0, shapeNode.width, shapeNode.height), r.auxFill)
    } else if (isPathShape(shapeNode)) {
      drawPathShape(r, canvas, shapeNode, shapeHasRadius)
    } else if (nodeHasSmoothCorners(shapeNode)) {
      const path = makeSmoothRRectPath(r, shapeNode)
      canvas.drawPath(path, r.auxFill)
      path.delete()
    } else if (shapeHasRadius) {
      canvas.drawRRect(r.makeRRect(shapeNode), r.auxFill)
    } else {
      canvas.drawRect(r.ltrb(0, 0, shapeNode.width, shapeNode.height), r.auxFill)
    }
  } finally {
    canvas.restore()
    r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
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
  const hasVisibleFill = node.fills.some((fill) => fill.visible)
  let geometryShadow: Path[] | null = null
  if (!shadowShapeChild) {
    if (hasVisibleFill) {
      geometryShadow = r.getFillGeometry(node)
    } else if (node.childIds.length === 0 && node.strokeGeometry.length > 0) {
      geometryShadow = r.getStrokeGeometry(node)
    }
  }

  r.auxFill.setColor(r.color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a))
  r.auxFill.setMaskFilter(r.getCachedMaskBlur(effect.radius / 2))
  r.auxFill.setImageFilter(null)
  r.auxFill.setBlendMode(figmaBlendModeToSkia(r.ck, effect.blendMode))
  canvas.save()
  let savedLayer = false
  try {
    if (shadowShapeChild) drawChildTransform(canvas, shadowShapeChild, effect.offset)
    else canvas.translate(effect.offset.x, effect.offset.y)

    const shouldHideShadowBehindUnfilledNode =
      effect.showShadowBehindNode === false && !hasVisibleFill && !shadowShapeChild
    if (shouldHideShadowBehindUnfilledNode) {
      resetEffectLayerPaint(r)
      canvas.saveLayer(r.effectLayerPaint, effectLayerBounds(r, shapeNode, effect))
      savedLayer = true
    }

    if (geometryShadow) {
      for (const path of geometryShadow) drawShadowGeometryPath(r, canvas, path, sp)
    } else if (shapeNode.type === 'ELLIPSE') {
      canvas.drawOval(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
    } else if (isPathShape(shapeNode)) {
      drawPathShape(r, canvas, shapeNode, shapeHasRadius, sp)
    } else if (nodeHasSmoothCorners(shapeNode)) {
      const path = makeSmoothRRectPath(r, shapeNode, sp)
      canvas.drawPath(path, r.auxFill)
      path.delete()
    } else if (shapeHasRadius) {
      canvas.drawRRect(r.makeRRectWithSpread(shapeNode, sp), r.auxFill)
    } else {
      canvas.drawRect(r.ltrb(-sp, -sp, shapeNode.width + sp, shapeNode.height + sp), r.auxFill)
    }
    if (shouldHideShadowBehindUnfilledNode) {
      drawShadowCutout(r, canvas, node, effect, shapeNode, shapeHasRadius, geometryShadow)
    }
  } finally {
    if (savedLayer) canvas.restore()
    canvas.restore()
    r.auxFill.setMaskFilter(null)
    r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
    resetEffectLayerPaint(r)
  }
}

function renderDropShadow(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  effect: SceneNode['effects'][number],
  hasRadius: boolean,
  shadowShapeChild?: SceneNode | null
): void {
  resetEffectLayerPaint(r)

  const shapeNode = shadowShapeChild ?? node
  if (shapeNode.type !== 'TEXT') {
    drawShapeDropShadow(r, canvas, node, effect, hasRadius, shadowShapeChild)
    resetEffectLayerPaint(r)
    return
  }

  const shadowColor = r.ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a)
  const dropFilter = r.getCachedDropShadow(0, 0, effect.radius / 2, shadowColor)

  canvas.save()
  let savedLayer = false
  try {
    if (shadowShapeChild) drawChildTransform(canvas, shadowShapeChild, effect.offset)
    else canvas.translate(effect.offset.x, effect.offset.y)

    r.effectLayerPaint.setBlendMode(figmaBlendModeToSkia(r.ck, effect.blendMode))
    r.effectLayerPaint.setImageFilter(dropFilter)
    canvas.saveLayer(r.effectLayerPaint, effectLayerBounds(r, shapeNode, effect))
    savedLayer = true
    r.renderText(canvas, shapeNode)
  } finally {
    if (savedLayer) canvas.restore()
    canvas.restore()
    resetEffectLayerPaint(r)
  }
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

  resetEffectLayerPaint(r)
  let restoreCount = 0
  let tintFilter: ReturnType<typeof ck.ColorFilter.MakeBlend> | null = null
  let solidBlackFilter: ReturnType<typeof ck.ColorFilter.MakeBlend> | null = null

  try {
    canvas.save()
    restoreCount++
    if (shadowShapeChild) drawChildTransform(canvas, shadowShapeChild)

    const bounds = effectLayerBounds(r, shapeNode, effect)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++
    r.renderText(canvas, shapeNode)

    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcIn)
    tintFilter = ck.ColorFilter.MakeBlend(
      ck.Color4f(effect.color.r, effect.color.g, effect.color.b, effect.color.a),
      ck.BlendMode.SrcIn
    )
    r.effectLayerPaint.setColorFilter(tintFilter)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++

    const { x: localOffsetX, y: localOffsetY } = localEffectOffset(effect, shadowShapeChild)
    canvas.save()
    restoreCount++
    canvas.translate(localOffsetX, localOffsetY)

    r.effectLayerPaint.setBlendMode(ck.BlendMode.SrcOver)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setImageFilter(r.getCachedDecalBlur(effect.radius / 2))
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++

    const expand = effect.radius * 2 + Math.max(Math.abs(localOffsetX), Math.abs(localOffsetY))
    const giantRect = ck.LTRBRect(
      -expand,
      -expand,
      shapeNode.width + expand,
      shapeNode.height + expand
    )
    r.auxFill.setColor(ck.Color4f(0, 0, 0, 1))
    canvas.drawRect(giantRect, r.auxFill)

    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setBlendMode(ck.BlendMode.DstOut)
    solidBlackFilter = ck.ColorFilter.MakeBlend(ck.Color4f(0, 0, 0, 1), ck.BlendMode.SrcIn)
    r.effectLayerPaint.setColorFilter(solidBlackFilter)
    canvas.saveLayer(r.effectLayerPaint, bounds)
    restoreCount++
    r.renderText(canvas, shapeNode)
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
  r.auxFill.setBlendMode(figmaBlendModeToSkia(r.ck, effect.blendMode))

  const shapeRect = shadowShapeChild ? r.ck.LTRBRect(0, 0, shapeNode.width, shapeNode.height) : rect
  const shapeHasRadius = shadowShapeChild ? nodeHasRadius(shadowShapeChild) : hasRadius

  canvas.save()
  try {
    if (shadowShapeChild) drawChildTransform(canvas, shadowShapeChild)

    if (shapeNode.type === 'ELLIPSE') {
      const path = new r.ck.Path()
      try {
        path.addOval(shapeRect)
        canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
      } finally {
        path.delete()
      }
    } else if (isPathShape(shapeNode)) {
      const path = makeNodeShapePath(r, shapeNode, shapeRect, shapeHasRadius)
      try {
        canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
      } finally {
        path.delete()
      }
    } else if (nodeHasSmoothCorners(shapeNode)) {
      const path = makeSmoothRRectPath(r, shapeNode)
      canvas.clipPath(path, r.ck.ClipOp.Intersect, true)
      path.delete()
    } else if (shapeHasRadius) {
      canvas.clipRRect(r.makeRRect(shapeNode), r.ck.ClipOp.Intersect, true)
    } else {
      canvas.clipRect(shapeRect, r.ck.ClipOp.Intersect, true)
    }

    const expand = effect.radius * 2
    const { x: localOffsetX, y: localOffsetY } = localEffectOffset(effect, shadowShapeChild)

    const spreadPadding = sp < 0 ? -sp : 0
    const big = r.ck.LTRBRect(
      Math.min(-expand, -expand + localOffsetX - spreadPadding),
      Math.min(-expand, -expand + localOffsetY - spreadPadding),
      Math.max(shapeNode.width + expand, shapeNode.width + expand + localOffsetX + spreadPadding),
      Math.max(shapeNode.height + expand, shapeNode.height + expand + localOffsetY + spreadPadding)
    )
    const bigPath = new r.ck.Path()
    try {
      bigPath.addRect(big)
      if (shapeNode.type === 'ELLIPSE') {
        const innerPath = new r.ck.Path()
        try {
          const offsetRect = r.ck.LTRBRect(
            localOffsetX + sp,
            localOffsetY + sp,
            shapeNode.width + localOffsetX - sp,
            shapeNode.height + localOffsetY - sp
          )
          innerPath.addOval(offsetRect)
          bigPath.op(innerPath, r.ck.PathOp.Difference)
        } finally {
          innerPath.delete()
        }
      } else if (isPathShape(shapeNode)) {
        const innerPath = makeNodeShapePath(r, shapeNode, shapeRect, shapeHasRadius)
        try {
          innerPath.transform(r.ck.Matrix.translated(localOffsetX, localOffsetY))
          applySpreadToPath(r, innerPath, -sp)
          bigPath.op(innerPath, r.ck.PathOp.Difference)
        } finally {
          innerPath.delete()
        }
      } else if (nodeHasSmoothCorners(shapeNode)) {
        const innerPath = makeSmoothRRectPath(r, shapeNode, -sp, localOffsetX, localOffsetY)
        try {
          bigPath.op(innerPath, r.ck.PathOp.Difference)
        } finally {
          innerPath.delete()
        }
      } else if (shapeHasRadius) {
        const innerPath = new r.ck.Path()
        try {
          innerPath.addRRect(r.makeRRectWithOffset(shapeNode, localOffsetX, localOffsetY, sp))
          bigPath.op(innerPath, r.ck.PathOp.Difference)
        } finally {
          innerPath.delete()
        }
      } else {
        const innerPath = new r.ck.Path()
        try {
          innerPath.addRect(
            r.ck.LTRBRect(
              localOffsetX + sp,
              localOffsetY + sp,
              shapeNode.width + localOffsetX - sp,
              shapeNode.height + localOffsetY - sp
            )
          )
          bigPath.op(innerPath, r.ck.PathOp.Difference)
        } finally {
          innerPath.delete()
        }
      }
      canvas.drawPath(bigPath, r.auxFill)
    } finally {
      bigPath.delete()
    }
  } finally {
    canvas.restore()
    r.auxFill.setImageFilter(null)
    r.auxFill.setBlendMode(r.ck.BlendMode.SrcOver)
  }
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
  if (pass === 'front') {
    for (const effect of rawNoiseEffects(node)) {
      renderNoiseEffect(r, canvas, node, rect, hasRadius, effect)
    }
  }

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
