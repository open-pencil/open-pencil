import { DEFAULT_FONT_SIZE, DEFAULT_FONT_FAMILY } from '../constants'
import { isFontLoaded, getCJKFallbackFamily } from '../fonts'

import type { SceneNode } from '../scene-graph'
import type { CanvasKit, FontWeight, Paragraph, TypefaceFontProvider } from 'canvaskit-wasm'

interface TextRenderer {
  ck: CanvasKit
  fontProvider: TypefaceFontProvider | null
  fontsLoaded: boolean
}

export function isNodeFontLoaded(_r: TextRenderer, node: SceneNode): boolean {
  const families = new Set<string>()
  families.add(node.fontFamily || DEFAULT_FONT_FAMILY)
  for (const run of node.styleRuns) {
    if (run.style.fontFamily) families.add(run.style.fontFamily)
  }
  return [...families].every((f) => isFontLoaded(f))
}

export function measureTextNode(
  r: TextRenderer,
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } | null {
  if (!r.fontsLoaded || !r.fontProvider) return null
  if (node.type !== 'TEXT' || !node.text) return null

  const paragraph = buildParagraph(r, node)
  const layoutWidth =
    maxWidth !== undefined
      ? maxWidth
      : (node.textAutoResize === 'WIDTH_AND_HEIGHT'
          ? 1e6
          : node.width || 1e6)
  paragraph.layout(layoutWidth)
  const width = paragraph.getLongestLine()
  const height = paragraph.getHeight()
  paragraph.delete()
  return { width: Math.ceil(width), height: Math.ceil(height) }
}

export function buildTextPicture(r: TextRenderer, node: SceneNode): Uint8Array | null {
  if (!r.fontsLoaded || !r.fontProvider) return null
  if (node.type !== 'TEXT' || !node.text) return null

  const ck = r.ck
  const recorder = new ck.PictureRecorder()
  const bounds = ck.LTRBRect(0, 0, node.width || 1e6, node.height || 1e6)
  const recCanvas = recorder.beginRecording(bounds)

  const paragraph = buildParagraph(r, node, undefined, { halfLeading: true })
  recCanvas.drawParagraph(paragraph, 0, 0)
  paragraph.delete()

  const picture = recorder.finishRecordingAsPicture()
  recorder.delete()

  const bytes = picture.serialize()
  picture.delete()
  return bytes ?? null
}

function buildTruncateOpts(
  node: SceneNode,
  baseFontSize: number
): { maxLines?: number; ellipsis?: string } {
  if (node.textTruncation !== 'ENDING') return {}

  const opts: { maxLines?: number; ellipsis: string } = { ellipsis: '…' }
  if (node.maxLines != null && node.maxLines > 0) {
    opts.maxLines = node.maxLines
  } else if (node.height > 0) {
    const lineH = node.lineHeight || baseFontSize * 1.2
    opts.maxLines = Math.max(1, Math.floor(node.height / lineH))
  }
  return opts
}

function getTextAlign(ck: CanvasKit, align: string) {
  switch (align) {
    case 'CENTER':
      return ck.TextAlign.Center
    case 'RIGHT':
      return ck.TextAlign.Right
    case 'JUSTIFIED':
      return ck.TextAlign.Justify
    default:
      return ck.TextAlign.Left
  }
}

function textDecorationValue(ck: CanvasKit, decoration: string): number {
  switch (decoration) {
    case 'UNDERLINE':
      return ck.UnderlineDecoration
    case 'STRIKETHROUGH':
      return ck.LineThroughDecoration
    default:
      return ck.NoDecoration
  }
}

function addStyledRuns(
  r: TextRenderer,
  builder: ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>,
  node: SceneNode,
  baseColor: Float32Array,
  baseFontSize: number,
  fontFamilies: (primary: string) => string[],
  halfLeading: boolean
): void {
  const ck = r.ck
  const text = node.text
  let pos = 0

  for (const run of node.styleRuns) {
    if (pos < run.start) {
      builder.addText(text.slice(pos, run.start))
    }
    const s = run.style
    const runLineHeight = s.lineHeight !== undefined ? s.lineHeight : node.lineHeight
    const runFontSize = s.fontSize ?? baseFontSize

    let runColor = baseColor
    if (s.fills) {
      const visibleFill = s.fills.find((f) => f.visible && f.type === 'SOLID')
      if (visibleFill) {
        const c = visibleFill.color
        runColor = ck.Color4f(c.r, c.g, c.b, c.a * visibleFill.opacity)
      }
    }

    builder.pushStyle(
      new ck.TextStyle({
        color: runColor,
        fontFamilies: fontFamilies(s.fontFamily ?? (node.fontFamily || DEFAULT_FONT_FAMILY)),
        fontSize: runFontSize,
        fontStyle: {
          weight: { value: (s.fontWeight ?? node.fontWeight) || 400 } as FontWeight,
          slant: (s.italic ?? node.italic) ? ck.FontSlant.Italic : ck.FontSlant.Upright
        },
        letterSpacing: s.letterSpacing ?? (node.letterSpacing || 0),
        decoration: textDecorationValue(ck, s.textDecoration ?? node.textDecoration),
        heightMultiplier: runLineHeight ? runLineHeight / runFontSize : undefined,
        halfLeading
      })
    )
    builder.addText(text.slice(run.start, run.start + run.length))
    builder.pop()
    pos = run.start + run.length
  }

  if (pos < text.length) {
    builder.addText(text.slice(pos))
  }
}

export function buildParagraph(
  r: TextRenderer,
  node: SceneNode,
  color?: Float32Array,
  { halfLeading = false }: { halfLeading?: boolean } = {}
): Paragraph {
  const ck = r.ck
  const baseColor = color ?? ck.BLACK
  const baseFontSize = node.fontSize || DEFAULT_FONT_SIZE
  const cjkFallback = getCJKFallbackFamily()

  const truncateOpts = buildTruncateOpts(node, baseFontSize)

  const fontFamilies = (primary: string) => {
    const families = [primary]
    if (primary !== DEFAULT_FONT_FAMILY) families.push(DEFAULT_FONT_FAMILY)
    if (cjkFallback) families.push(cjkFallback)
    return families
  }

  const paraStyle = new ck.ParagraphStyle({
    textAlign: getTextAlign(ck, node.textAlignHorizontal),
    ...truncateOpts,
    textStyle: {
      color: baseColor,
      fontFamilies: fontFamilies(node.fontFamily || DEFAULT_FONT_FAMILY),
      fontSize: baseFontSize,
      fontStyle: {
        weight: { value: node.fontWeight || 400 } as FontWeight,
        slant: node.italic ? ck.FontSlant.Italic : ck.FontSlant.Upright
      },
      letterSpacing: node.letterSpacing || 0,
      decoration: textDecorationValue(ck, node.textDecoration),
      heightMultiplier: node.lineHeight ? node.lineHeight / baseFontSize : undefined,
      halfLeading
    }
  })

  if (!r.fontProvider) throw new Error('Font provider not initialized')
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, r.fontProvider)

  if (node.styleRuns.length === 0) {
    builder.addText(node.text)
  } else {
    addStyledRuns(r, builder, node, baseColor, baseFontSize, fontFamilies, halfLeading)
  }

  const paragraph = builder.build()
  paragraph.layout(node.width || 1e6)
  builder.delete()
  return paragraph
}
