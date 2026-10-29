import type { Canvas, Image, Paint } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import { ResourceCache } from '#core/cache/resource'
import type { SkiaRenderer } from '#core/canvas/renderer'
import {
  applyGlyphTransform,
  hasRotatedDerivedGlyphs,
  snapDerivedGlyphBaseline
} from '#core/canvas/text/derived'
import type { TextLayout } from '#core/canvas/text/layout'
import { characterFamily, laidOutGlyphs } from '#core/canvas/text/placed'
import { shownText } from '#core/text/case'
import {
  canDrawPlatformEmoji,
  EMOJI_METRICS_FAMILY,
  emojiText,
  mayHoldEmoji
} from '#core/text/emoji'
import { nextGraphemeBoundary } from '#core/text/graphemes'

import { rasterizeNotoEmoji, rasterizePlatformEmoji } from './raster'

/** Distinct emoji a renderer keeps drawn: one image each, at most a few hundred on a page. */
const MAX_EMOJI_IMAGES = 512

/**
 * Emoji images by what draws them and the emoji they show. An emoji the source cannot draw is
 * kept as `null`, so it is not drawn again each frame.
 */
export function createEmojiImageCache(): ResourceCache<string, Image | null> {
  return new ResourceCache({ maxEntries: MAX_EMOJI_IMAGES, dispose: (image) => image?.delete() })
}

function rasterizeEmoji(r: SkiaRenderer, platform: boolean, text: string): Image | null {
  if (platform) return rasterizePlatformEmoji(r.ck, text)
  return r.fontProvider ? rasterizeNotoEmoji(r.ck, r.fontProvider, text) : null
}

function emojiImage(r: SkiaRenderer, text: string): Image | null {
  const platform = canDrawPlatformEmoji()
  // Noto draws only once its font is loaded, so a later font generation tries again.
  const key = platform ? `platform:${text}` : `noto:${r.fontGeneration}:${text}`
  const cached = r.emojiImageCache.get(key)
  if (cached !== undefined) return cached
  const image = rasterizeEmoji(r, platform, text)
  r.emojiImageCache.set(key, image)
  return image
}

/**
 * Draws `image` over an emoji's square, 1 em wide from 0.07 em below the baseline at the
 * canvas origin, as Figma places it.
 */
function drawEmojiSquare(
  r: SkiaRenderer,
  canvas: Canvas,
  image: Image,
  size: number,
  paint: Paint
): void {
  canvas.drawImageRectOptions(
    image,
    r.ck.LTRBRect(0, 0, image.width(), image.height()),
    r.ck.LTRBRect(0, -0.93 * size, size, 0.07 * size),
    r.ck.FilterMode.Linear,
    r.ck.MipmapMode.Linear,
    paint
  )
}

function withEmojiPaint(r: SkiaRenderer, draw: (paint: Paint) => void): void {
  const paint = new r.ck.Paint()
  paint.setAntiAlias(true)
  try {
    draw(paint)
  } finally {
    paint.delete()
  }
}

/**
 * Draws the emoji among a text's saved glyphs. Figma saves an emoji as a placeholder square
 * 1 em wide, from 0.07 em below the baseline, and draws the emoji's image over that square in
 * its own colours: the text's fills never reach it, while the layer's opacity does.
 */
export function drawSavedEmoji(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
  const glyphs = node.derivedTextGlyphs
  if (!glyphs?.some((glyph) => glyph.emojiCodePoints)) return
  // Baselines snap as the saved glyphs around the emoji do.
  const snapBaselines = !hasRotatedDerivedGlyphs(node)
  withEmojiPaint(r, (paint) => {
    for (const glyph of glyphs) {
      if (!glyph.emojiCodePoints || glyph.fontSize <= 0) continue
      const image = emojiImage(r, emojiText(glyph))
      if (!image) continue
      canvas.save()
      applyGlyphTransform(
        canvas,
        glyph,
        snapBaselines ? snapDerivedGlyphBaseline(glyph.y) : glyph.y
      )
      drawEmojiSquare(r, canvas, image, glyph.fontSize, paint)
      canvas.restore()
    }
  })
}

/**
 * Draws the emoji of text the editor laid out, `offsetY` below its top. The layout falls back
 * to the emoji metrics font for a character no text font has, which gives it Figma's 1 em
 * square and draws nothing in it; its image is drawn there as a saved emoji's is.
 */
export function drawLaidOutEmoji(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  layout: TextLayout,
  offsetY: number
): void {
  const text = shownText(node)
  if (!mayHoldEmoji(text)) return
  const glyphs = laidOutGlyphs(node, layout, text, offsetY)
  if (!glyphs) return
  withEmojiPaint(r, (paint) => {
    // A sequence the font does not join is several glyphs; its image is drawn once, at its first.
    let drawnUntil = 0
    for (const glyph of glyphs) {
      const start = glyph.firstCharacter
      if (start === undefined || start < drawnUntil || glyph.fontSize <= 0) continue
      if (characterFamily(node, text, start) !== EMOJI_METRICS_FAMILY) continue
      drawnUntil = nextGraphemeBoundary(text, start)
      const image = emojiImage(r, text.slice(start, drawnUntil))
      if (!image) continue
      canvas.save()
      canvas.translate(glyph.x, glyph.y)
      drawEmojiSquare(r, canvas, image, glyph.fontSize, paint)
      canvas.restore()
    }
  })
}
