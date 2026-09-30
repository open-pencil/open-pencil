import type {
  Canvas,
  CanvasKit,
  Font,
  FontWeight,
  Paragraph,
  TypefaceFontProvider
} from 'canvaskit-wasm'

import type { Size } from '@open-pencil/scene-graph'
import { detectTextDirection } from '@open-pencil/scene-graph/text-direction'

import { ResourceCache } from '#core/cache/resource'
import { resolveParagraphFontFamilies } from '#core/canvas/text/font-families'
import { DEFAULT_FONT_FAMILY } from '#core/constants'
import { textHasFallbackScript } from '#core/text/coverage'
import { weightToStyle } from '#core/text/fonts'
import { missingGlyphOccurrences, type MissingGlyphOccurrence } from '#core/text/resolver'

export type LabelParagraphMetrics = Readonly<Size>

/** Borrowed only for the synchronous use() callback; do not delete or retain the paragraph. */
export interface BorrowedLabelParagraph {
  readonly paragraph: Paragraph
  readonly metrics: LabelParagraphMetrics
}

export interface LabelFontOptions {
  families?: (weight: number) => string[]
  onMissingGlyphs?: (missing: readonly MissingGlyphOccurrence[]) => void
}

interface LabelParagraphEntry extends BorrowedLabelParagraph {
  units: number
  layoutWidth: number
  reuseFrom: number | null
  users: number
  retired: boolean
}

const MAX_LABEL_PARAGRAPHS = 512
const MAX_LABEL_TEXT_UNITS = 262_144
const HARD_BREAK = /[\r\n\f\v\u0085\u2028\u2029]/u

export function measureGlyphWidth(font: Font, text: string): number {
  let width = 0
  for (const advance of font.getGlyphWidths(font.getGlyphIDs(text))) width += advance
  return width
}

function retire(entry: LabelParagraphEntry): void {
  entry.retired = true
  if (entry.users === 0) entry.paragraph.delete()
}

function buildEntry(
  ck: CanvasKit,
  provider: TypefaceFontProvider,
  text: string,
  fontSize: number,
  width: number,
  color: Float32Array,
  fontWeight: number,
  fonts: LabelFontOptions
): LabelParagraphEntry {
  const style = new ck.ParagraphStyle({
    maxLines: 1,
    ellipsis: '…',
    textDirection:
      detectTextDirection(text) === 'RTL' ? ck.TextDirection.RTL : ck.TextDirection.LTR,
    textAlign: ck.TextAlign.Left,
    textStyle: {
      color,
      fontFamilies:
        fonts.families?.(fontWeight) ??
        resolveParagraphFontFamilies(DEFAULT_FONT_FAMILY, weightToStyle(fontWeight)),
      fontSize,
      fontStyle: { weight: { value: fontWeight } as FontWeight }
    }
  })
  const builder = ck.ParagraphBuilder.MakeFromFontProvider(style, provider)
  let paragraph: Paragraph
  try {
    builder.addText(text)
    paragraph = builder.build()
  } finally {
    builder.delete()
  }
  try {
    paragraph.layout(width)
    if (fonts.onMissingGlyphs && textHasFallbackScript(text)) {
      fonts.onMissingGlyphs(missingGlyphOccurrences(text, paragraph.getShapedLines()))
    }
    const longest = paragraph.getLongestLine()
    let reuseFrom: number | null = null
    // Labels stay physically left-aligned, including RTL text; unwrapped text keeps its origin.
    // Never speculate with an extra unconstrained layout, or reuse hard-break/ellipsized text.
    if (!HARD_BREAK.test(text) && !paragraph.didExceedMaxLines()) {
      const intrinsic = Math.max(paragraph.getMaxIntrinsicWidth(), longest)
      if (Number.isFinite(intrinsic) && intrinsic <= width) reuseFrom = intrinsic
    }
    return {
      paragraph,
      metrics: { width: Math.min(longest, width), height: paragraph.getHeight() },
      units: text.length,
      layoutWidth: width,
      reuseFrom,
      users: 0,
      retired: false
    }
  } catch (error) {
    paragraph.delete()
    throw error
  }
}

export class LabelParagraphCache {
  private readonly entries: ResourceCache<string, LabelParagraphEntry>
  private fontGeneration = -1
  private provider: TypefaceFontProvider | null = null

  constructor(
    maxEntries = MAX_LABEL_PARAGRAPHS,
    private readonly maxTextUnits = MAX_LABEL_TEXT_UNITS,
    private readonly fonts: LabelFontOptions = {}
  ) {
    this.entries = new ResourceCache({
      maxEntries,
      maxWeight: maxTextUnits,
      weight: (entry) => entry.units,
      dispose: retire
    })
  }

  use<T>(
    ck: CanvasKit,
    provider: TypefaceFontProvider,
    text: string,
    fontSize: number,
    maxWidth: number,
    color: Float32Array,
    generation: number,
    consume: (entry: BorrowedLabelParagraph) => T,
    fontWeight = 400
  ): T {
    if (generation !== this.fontGeneration || provider !== this.provider) {
      this.clear()
      this.fontGeneration = generation
      this.provider = provider
    }
    const width = Math.max(1, maxWidth)
    const base =
      text.length <= this.maxTextUnits
        ? `${fontSize}\0${fontWeight}\0${color[0]},${color[1]},${color[2]},${color[3]}\0${text}`
        : null
    const fitKey = `fit\0${base}`
    const exactKey = `${width}\0${base}`
    let entry: LabelParagraphEntry | undefined
    if (base !== null) {
      const fitting = this.entries.peek(fitKey)
      // SkParagraph floors its SkScalar (float32) layout width before line breaking.
      // This guards reuse only; pass the original width unchanged to native layout.
      const fits =
        fitting &&
        fitting.reuseFrom !== null &&
        (width === fitting.layoutWidth || Math.floor(Math.fround(width)) > fitting.reuseFrom)
      entry = this.entries.get(fits ? fitKey : exactKey)
    }
    const cached = entry !== undefined
    entry ??= buildEntry(ck, provider, text, fontSize, width, color, fontWeight, this.fonts)
    entry.users++
    try {
      if (!cached) {
        const key = entry.reuseFrom === null ? exactKey : fitKey
        if (base === null || !this.entries.set(key, entry)) entry.retired = true
      }
      return consume(entry)
    } finally {
      entry.users--
      if (entry.retired && entry.users === 0) entry.paragraph.delete()
    }
  }

  measure(
    ck: CanvasKit,
    provider: TypefaceFontProvider,
    text: string,
    fontSize: number,
    maxWidth: number,
    color: Float32Array,
    generation: number,
    fontWeight = 400
  ): LabelParagraphMetrics {
    return this.use(
      ck,
      provider,
      text,
      fontSize,
      maxWidth,
      color,
      generation,
      (entry) => entry.metrics,
      fontWeight
    )
  }

  draw(
    ck: CanvasKit,
    canvas: Canvas,
    provider: TypefaceFontProvider,
    text: string,
    fontSize: number,
    maxWidth: number,
    color: Float32Array,
    generation: number,
    x: number,
    y: number,
    fontWeight = 400
  ): number {
    return this.use(
      ck,
      provider,
      text,
      fontSize,
      maxWidth,
      color,
      generation,
      (entry) => {
        canvas.drawParagraph(entry.paragraph, x, y)
        return entry.metrics.width
      },
      fontWeight
    )
  }

  clear(): void {
    this.provider = null
    this.fontGeneration = -1
    this.entries.clear()
  }

  size(): number {
    return this.entries.size
  }
  textUnits(): number {
    return this.entries.weight
  }
}
