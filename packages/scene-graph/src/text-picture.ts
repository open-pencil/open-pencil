import type { CharacterStyleOverride, SceneNode, StyleRun } from './types'

const TEXT_RENDERING_GEOMETRY_KEYS = [
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'textAlignHorizontal',
  'textDirection',
  'textAlignVertical',
  'textAutoResize',
  'lineHeight',
  'letterSpacing',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset',
  'textCase',
  'leadingTrim',
  'maxLines',
  'styleRuns',
  'fontVariations',
  'fontFeatures',
  'textTruncation',
  'width',
  'height'
] as const

export const TEXT_PICTURE_KEYS: ReadonlySet<string> = new Set([
  ...TEXT_RENDERING_GEOMETRY_KEYS,
  'fills'
])

export const FIGMA_DERIVED_TEXT_GLYPH_KEYS: ReadonlySet<string> = new Set(
  TEXT_RENDERING_GEOMETRY_KEYS
)

const STYLE_RUN_GLYPH_GEOMETRY_KEYS = [
  'fontWeight',
  'italic',
  'fontSize',
  'fontFamily',
  'letterSpacing',
  'lineHeight',
  'fontVariations',
  'fontFeatures'
] as const satisfies readonly (keyof CharacterStyleOverride)[]

type StyleRunGlyphGeometryKey = (typeof STYLE_RUN_GLYPH_GEOMETRY_KEYS)[number]
type StyleRunGlyphGeometry = Pick<CharacterStyleOverride, StyleRunGlyphGeometryKey>

export function invalidatesTextPicture(key: string): boolean {
  return TEXT_PICTURE_KEYS.has(key)
}

export function invalidatesFigmaDerivedTextGlyphs(key: string): boolean {
  return FIGMA_DERIVED_TEXT_GLYPH_KEYS.has(key)
}

function glyphGeometryStyleForRun(style: CharacterStyleOverride): Partial<StyleRunGlyphGeometry> {
  const geometry: Partial<StyleRunGlyphGeometry> = {}
  if (style.fontWeight !== undefined) geometry.fontWeight = style.fontWeight
  if (style.italic !== undefined) geometry.italic = style.italic
  if (style.fontSize !== undefined) geometry.fontSize = style.fontSize
  if (style.fontFamily !== undefined) geometry.fontFamily = style.fontFamily
  if (style.letterSpacing !== undefined) geometry.letterSpacing = style.letterSpacing
  if (style.lineHeight !== undefined) geometry.lineHeight = style.lineHeight
  if (style.fontVariations !== undefined) geometry.fontVariations = style.fontVariations
  if (style.fontFeatures !== undefined) geometry.fontFeatures = style.fontFeatures
  return geometry
}

function glyphGeometryStyleIsEmpty(style: Partial<StyleRunGlyphGeometry>): boolean {
  return Object.keys(style).length === 0
}

function fontVariationsSignature(value: CharacterStyleOverride['fontVariations']): string {
  if (value === undefined) return ''
  return value.map((item) => `${item.axis}:${item.value}`).join('|')
}

function fontFeaturesSignature(value: CharacterStyleOverride['fontFeatures']): string {
  if (value === undefined) return ''
  return value.map((item) => `${item.tag}:${item.enabled ? '1' : '0'}`).join('|')
}

function glyphGeometrySignature(style: Partial<StyleRunGlyphGeometry>): string {
  const parts: string[] = []
  if (style.fontWeight !== undefined) parts.push(`fontWeight=${style.fontWeight}`)
  if (style.italic !== undefined) parts.push(`italic=${style.italic ? '1' : '0'}`)
  if (style.fontSize !== undefined) parts.push(`fontSize=${style.fontSize}`)
  if (style.fontFamily !== undefined) parts.push(`fontFamily=${style.fontFamily}`)
  if (style.letterSpacing !== undefined) parts.push(`letterSpacing=${style.letterSpacing}`)
  if (style.lineHeight !== undefined) parts.push(`lineHeight=${style.lineHeight ?? 'null'}`)
  if (style.fontVariations !== undefined) {
    parts.push(`fontVariations=${fontVariationsSignature(style.fontVariations)}`)
  }
  if (style.fontFeatures !== undefined) {
    parts.push(`fontFeatures=${fontFeaturesSignature(style.fontFeatures)}`)
  }
  return parts.join('\u001f')
}

function styleRunGlyphGeometrySignatures(
  styleRuns: readonly StyleRun[],
  textLength: number
): string[] {
  const clampedLength = Math.max(0, textLength)
  const charStyles = Array.from(
    { length: clampedLength },
    (): Partial<StyleRunGlyphGeometry> => ({})
  )
  for (const run of styleRuns) {
    const geometry = glyphGeometryStyleForRun(run.style)
    if (glyphGeometryStyleIsEmpty(geometry)) continue
    const start = Math.max(0, run.start)
    const end = Math.min(clampedLength, run.start + run.length)
    for (let i = start; i < end; i++) {
      charStyles[i] = { ...charStyles[i], ...geometry }
    }
  }
  return charStyles.map(glyphGeometrySignature)
}

function styleRunsChangeGlyphGeometry(
  node: SceneNode,
  nextStyleRuns: readonly StyleRun[]
): boolean {
  const textLength = node.text.length
  const previous = styleRunGlyphGeometrySignatures(node.styleRuns, textLength)
  const next = styleRunGlyphGeometrySignatures(nextStyleRuns, textLength)
  if (previous.length !== next.length) return true
  return previous.some((signature, index) => signature !== next[index])
}

export function changesInvalidateFigmaDerivedTextGlyphs(
  node: SceneNode,
  changes: Partial<SceneNode>
): boolean {
  const keys = Object.keys(changes)
  for (const key of keys) {
    if (!invalidatesFigmaDerivedTextGlyphs(key)) continue
    if (key !== 'styleRuns') return true
    if (changes.styleRuns && styleRunsChangeGlyphGeometry(node, changes.styleRuns)) return true
  }
  return false
}

export function clearInvalidatedTextRenderingData(
  node: SceneNode,
  changes: Partial<SceneNode>
): void {
  if (node.type !== 'TEXT') return
  const changeKeys = Object.keys(changes)
  if (node.textPicture && changeKeys.some(invalidatesTextPicture)) node.textPicture = null
  if (node.figmaDerivedTextGlyphs && changesInvalidateFigmaDerivedTextGlyphs(node, changes)) {
    node.figmaDerivedTextGlyphs = null
  }
}
