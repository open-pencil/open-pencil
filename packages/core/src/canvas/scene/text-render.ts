import type { Canvas } from 'canvaskit-wasm'

import type { AbsPosFullInfo } from '#core/canvas/coordinate'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { requestFallbackFamiliesIfNeeded } from '#core/canvas/text'
import { drawFigmaDerivedText } from '#core/canvas/text-derived'
import type { SceneNode, Fill } from '#core/scene-graph'

function isGradientFill(fill?: Fill): boolean {
  return fill?.type.startsWith('GRADIENT') === true
}

/**
 * Render text with a gradient fill using a two-layer mask technique:
 * 1. Draw text glyphs as alpha mask (saveLayer + drawParagraph)
 * 2. Apply gradient fill through the mask (SrcIn saveLayer + drawRect)
 *
 * Returns true if gradient text was rendered (caller should restore+exit),
 * false if gradient text rendering should not proceed.
 *
 * The caller (renderText) manages its own canvas.save/restore — this
 * function does NOT call canvas.save/restore on behalf of the caller.
 * If this function pushes saveLayer(s) and then throws, the finally
 * block restores them to prevent canvas stack corruption.
 */
function drawGradientText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  paragraphY: number
): boolean {
  if (!r.fontsLoaded || !r.fontProvider) return false

  const paragraph = r.buildParagraph(node, r.ck.Color4f(0, 0, 0, 1))
  // Track how many saveLayer(s) we push so the finally block can
  // restore them if an exception occurs before the normal restore
  // sequence completes. On the happy path, we set savedLayers = 0
  // before returning, so the finally block does nothing extra.
  let savedLayers = 0
  try {
    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    canvas.saveLayer(r.effectLayerPaint)
    savedLayers = 1
    canvas.drawParagraph(paragraph, 0, paragraphY)

    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcIn)
    canvas.saveLayer(r.effectLayerPaint)
    savedLayers = 2
    canvas.drawRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.fillPaint)
    canvas.restore() // Pops gradient mask layer
    savedLayers = 1
    canvas.restore() // Pops text layer
    savedLayers = 0

    r.effectLayerPaint.setImageFilter(null)
    r.effectLayerPaint.setColorFilter(null)
    r.effectLayerPaint.setBlendMode(r.ck.BlendMode.SrcOver)
    return true
  } finally {
    paragraph.delete()
    // Restore any saveLayer(s) we pushed but didn't pop on the
    // exception path. This prevents canvas stack corruption that
    // would cascade up the render tree.
    while (savedLayers > 0) {
      canvas.restore()
      savedLayers--
    }
  }
}

/**
 * Text LOD: attempt to render the node as a simplified filled rectangle
 * when its screen area is below the readability threshold.
 * Returns true if the node was LOD-rendered (caller should restore+exit),
 * false if normal text rendering should proceed.
 *
 * The caller (renderText) manages its own canvas.save/restore — this
 * function does NOT call canvas.restore() on behalf of the caller.
 */
function tryRenderTextLOD(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  fill?: Fill,
  isFirstDrawnFill = true
): boolean {
  // Guard: only activate when the feature is explicitly enabled with a positive threshold
  if (!(r.minScreenSizeForText > 0)) return false

  // Guard: skip LOD in non-fill rendering paths (shadow, gradient mask).
  // Shadow rendering needs actual text glyphs as a clipping source — a
  // gray rectangle produces incorrect shadow shapes. When fill is
  // undefined, we're being called from renderEffects, not drawVisibleFills.
  if (fill == null) return false

  // Use world-space AABB dimensions when available (from renderNode's
  // cached absInfo). Falls back to local node dimensions for callers
  // outside the render pipeline. World-space dims account for rotation,
  // preventing incorrect gray-rect substitution for rotated text nodes
  // whose local area falls below the threshold but whose screen-space
  // AABB area is above it.
  const absInfo: AbsPosFullInfo | null = r._currentAbsInfo
  const worldW = absInfo?.width ?? node.width
  const worldH = absInfo?.height ?? node.height
  const textScreenArea = worldW * worldH * r.zoom * r.zoom
  // ── Adaptive LOD: boost threshold during active pan/zoom ──
  const boost = r._isViewportAnimating && r._adaptiveLodBoost > 0 ? r._adaptiveLodBoost : 1
  if (textScreenArea >= r.minScreenSizeForText * boost) return false

  // Increment counter only once per node (on the first drawn fill that
  // actually passed applyFill at runtime, not merely the first structurally
  // visible fill in node.fills).
  if (isFirstDrawnFill) {
    r._textLodCulledCount++
  }

  // Overdraw guard: drawVisibleFills calls renderText once per visible
  // fill that passes applyFill. We only draw the gray rect on the first
  // drawn fill pass — subsequent fills would produce identical rects
  // stacked on top, which is both wasteful and incorrect for
  // semi-transparent fills (alpha compositing N semi-transparent rects
  // ≠ single rect at fill opacity). We return true so renderText exits
  // early, but we skip the drawRect for non-first fills.
  if (!isFirstDrawnFill) {
    return true
  }

  // Guard against degenerate dimensions that produce undefined
  // Skia behavior in LTRBRect (NaN/Infinity/zero/negative).
  if (
    node.width <= 0 ||
    node.height <= 0 ||
    !Number.isFinite(node.width) ||
    !Number.isFinite(node.height)
  ) {
    return true
  }

  // The caller (drawVisibleFills) applies fill.opacity via
  // setAlphaf to fillPaint before this draw callback. Since we use
  // auxFill (a separate paint), we must apply the fill's opacity
  // explicitly on auxFill. We multiply fill.color.a by fill.opacity
  // directly in Color4f — consistent with the normal text rendering
  // path (text.ts addStyledRuns: c.a * visibleFill.opacity).
  // SOLID fills have fill.color at runtime, but GRADIENT and IMAGE fills
  // do NOT — they use gradientStops/imageHash instead. The TypeScript
  // Fill type declares `color: Color` as required, but gradient fills
  // omit it at runtime. Check by fill type to avoid accessing the
  // missing property; for non-SOLID fills, use a neutral gray placeholder
  // since the LOD rect is already a simplified representation.
  if (fill.type === 'SOLID') {
    // fill.color is present at runtime for SOLID fills.
    // Multiply intrinsic color alpha by layer opacity (consistent with text.ts).
    const c = fill.color
    r.auxFill.setColor(r.ck.Color4f(c.r, c.g, c.b, c.a * fill.opacity))
  } else {
    // GRADIENT/IMAGE fills lack .color — use neutral gray.
    // Opacity is baked directly into the Color4f alpha channel
    // since there is no intrinsic color alpha to multiply.
    r.auxFill.setColor(r.ck.Color4f(0.5, 0.5, 0.5, fill.opacity))
  }
  r.auxFill.setShader(null)
  r.auxFill.setMaskFilter(null)
  r.auxFill.setImageFilter(null)
  const rect = r.ck.LTRBRect(0, 0, node.width, node.height)
  canvas.drawRect(rect, r.auxFill)
  return true
}

export function renderText(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  fill?: Fill,
  isFirstDrawnFill = true
): void {
  const text = node.text
  if (!text) return

  canvas.save()
  try {
    // ── Text LOD: simplified rectangle for unreadably-small text ──
    if (tryRenderTextLOD(r, canvas, node, fill, isFirstDrawnFill)) {
      return
    }

    const shouldClipText = node.textAutoResize === 'NONE' || node.textAutoResize === 'TRUNCATE'
    if (shouldClipText) {
      canvas.clipRect(r.ck.LTRBRect(0, 0, node.width, node.height), r.ck.ClipOp.Intersect, false)
    }

    const paragraphY = -1

    if (node.textPicture) {
      const pic = r.ck.MakePicture(node.textPicture)
      if (pic) {
        try {
          canvas.drawPicture(pic)
        } finally {
          pic.delete()
        }
        return
      }
    }
    if (drawFigmaDerivedText(r, canvas, node)) {
      return
    }

    // Trigger lazy fallback font loading even when the node isn't fully
    // loaded yet — this is the exact scenario where we need fallbacks.
    requestFallbackFamiliesIfNeeded(r, node.text)

    if (!r.isNodeFontLoaded(node)) {
      return
    }

    if (isGradientFill(fill) && drawGradientText(r, canvas, node, paragraphY)) {
      return
    }

    if (r.fontsLoaded && r.fontProvider) {
      const paragraph = r.buildParagraph(node, r.fillPaint.getColor())
      try {
        canvas.drawParagraph(paragraph, 0, paragraphY)
      } finally {
        paragraph.delete()
      }
    } else if (r.textFont) {
      canvas.drawText(text, 0, node.fontSize || r.DEFAULT_FONT_SIZE, r.fillPaint, r.textFont)
    }
  } finally {
    canvas.restore()
  }
}
