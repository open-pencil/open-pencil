export interface FontFamilyStyle {
  family: string
  style: string
}

export interface ParsedFontStyle {
  weight: number
  italic: boolean
}

/**
 * The standard weights by the names Google Fonts gives them, which most fonts and Figma's font
 * list use; a font's own names can differ ("Semi Bold", "Book", "Heavy").
 */
export const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black'
}

const FONT_WEIGHT_ALIASES = [
  { weight: 100, names: ['thin', 'hairline', 'extrathin', 'ultrathin'] },
  { weight: 200, names: ['extralight', 'ultralight'] },
  { weight: 300, names: ['light'] },
  { weight: 400, names: ['regular', 'normal', 'book', 'roman', 'plain'] },
  { weight: 500, names: ['medium'] },
  { weight: 600, names: ['semibold', 'demibold'] },
  { weight: 700, names: ['bold'] },
  { weight: 800, names: ['extrabold', 'ultrabold'] },
  { weight: 900, names: ['black', 'heavy'] }
] as const

const FONT_WEIGHT_BY_STYLE: ReadonlyMap<string, number> = new Map(
  FONT_WEIGHT_ALIASES.flatMap(({ names, weight }) => names.map((name) => [name, weight] as const))
)

function normalizeFontStyleName(style: string): string {
  return style
    .toLowerCase()
    .replace(/italic|oblique/u, '')
    .replace(/[^a-z0-9]+/gu, '')
}

export function parseFontStyle(style: string | undefined): ParsedFontStyle {
  const raw = style ?? ''
  const italic = /(?:italic|oblique)/iu.test(raw)
  const normalized = normalizeFontStyleName(raw)
  const numericWeight = normalized.match(/(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/u)?.[1]
  return {
    weight: numericWeight ? Number(numericWeight) : (FONT_WEIGHT_BY_STYLE.get(normalized) ?? 400),
    italic
  }
}

export function styleToWeight(style: string | undefined): number {
  return parseFontStyle(style).weight
}

export function normalizeFontFamily(family: string): string {
  return family.replace(/\s+(Variable|\d+(?:pt|px|em))$/i, '')
}

export function faceLoadKey(weight: number, italic = false): string {
  const rounded = Math.round(weight / 100) * 100
  const label = FONT_WEIGHT_NAMES[rounded] ?? 'Regular'
  return italic ? `${label} Italic` : label
}

/**
 * The name Google Fonts gives the face at `weight` and slant ("SemiBold Italic", and "Italic"
 * for the regular weight), for a face whose font has not said its own.
 */
export function standardStyleName(weight: number, italic = false): string {
  const label = FONT_WEIGHT_NAMES[Math.round(weight / 100) * 100] ?? 'Regular'
  if (!italic) return label
  return label === 'Regular' ? 'Italic' : `${label} Italic`
}
