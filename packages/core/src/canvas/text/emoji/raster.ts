import type { CanvasKit, Image, TypefaceFontProvider } from 'canvaskit-wasm'

import { NOTO_COLOR_EMOJI_FAMILY } from '#core/text/emoji'

/** Emoji are drawn from square images this many pixels wide, as Figma draws its own. */
export const EMOJI_IMAGE_SIZE = 160

/**
 * Where the platform's emoji font puts its pen in an image `EMOJI_IMAGE_SIZE` wide at that font
 * size: the baseline this far down. Measured against Figma's Apple images, which Apple Color
 * Emoji draws to within a pixel at this offset.
 */
const PLATFORM_BASELINE = 0.8775

const PLATFORM_EMOJI_FONTS = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"'

function imageFromPixels(ck: CanvasKit, pixels: Uint8Array | Uint8ClampedArray): Image | null {
  return ck.MakeImage(
    {
      width: EMOJI_IMAGE_SIZE,
      height: EMOJI_IMAGE_SIZE,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    },
    pixels,
    EMOJI_IMAGE_SIZE * 4
  )
}

/** The emoji as the platform's own emoji font draws it, through the browser's 2D canvas. */
export function rasterizePlatformEmoji(ck: CanvasKit, text: string): Image | null {
  const canvas = new OffscreenCanvas(EMOJI_IMAGE_SIZE, EMOJI_IMAGE_SIZE)
  const context = canvas.getContext('2d')
  if (!context) return null
  context.font = `${EMOJI_IMAGE_SIZE}px ${PLATFORM_EMOJI_FONTS}`
  context.textBaseline = 'alphabetic'
  context.fillText(text, 0, EMOJI_IMAGE_SIZE * PLATFORM_BASELINE)
  return imageFromPixels(ck, context.getImageData(0, 0, EMOJI_IMAGE_SIZE, EMOJI_IMAGE_SIZE).data)
}

/**
 * The emoji drawn with Noto Color Emoji, once loaded into `provider`. Noto's glyphs are wider
 * than they are tall; the glyph's advance fills the image's width, centred on its height.
 */
export function rasterizeNotoEmoji(
  ck: CanvasKit,
  provider: TypefaceFontProvider,
  text: string
): Image | null {
  const surface = ck.MakeSurface(EMOJI_IMAGE_SIZE, EMOJI_IMAGE_SIZE)
  if (!surface) return null
  const style = new ck.ParagraphStyle({
    textStyle: {
      fontFamilies: [NOTO_COLOR_EMOJI_FAMILY],
      fontSize: EMOJI_IMAGE_SIZE,
      color: ck.BLACK
    }
  })
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(style, provider)
  try {
    builder.addText(text)
    const paragraph = builder.build()
    try {
      paragraph.layout(EMOJI_IMAGE_SIZE * 4)
      const advance = paragraph.getMaxIntrinsicWidth()
      if (advance <= 0) return null
      const scale = EMOJI_IMAGE_SIZE / advance
      const canvas = surface.getCanvas()
      canvas.clear(ck.TRANSPARENT)
      canvas.translate(0, (EMOJI_IMAGE_SIZE - paragraph.getHeight() * scale) / 2)
      canvas.scale(scale, scale)
      canvas.drawParagraph(paragraph, 0, 0)
      return surface.makeImageSnapshot()
    } finally {
      paragraph.delete()
    }
  } finally {
    builder.delete()
    surface.delete()
  }
}
