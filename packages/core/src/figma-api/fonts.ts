import { FONT_WEIGHT_NAMES } from '#core/text/fonts'

export type FigmaFontName = { family: string; style: string }
export type FigmaFont = { fontName: FigmaFontName }

export function weightToStyleName(weight: number, italic: boolean): string {
  const base = FONT_WEIGHT_NAMES[weight] ?? 'Regular'
  return italic ? `${base} Italic` : base
}

const STYLE_NAME_TO_WEIGHT: Record<string, number> = Object.fromEntries([
  ...Object.entries(FONT_WEIGHT_NAMES).map(([w, name]) => [name.toLowerCase(), Number(w)]),
  ['ultra light', 200],
  ['', 400],
  ['demi bold', 600],
  ['ultra bold', 800],
  ['heavy', 900]
])

export function styleNameToWeight(style: string): { weight: number; italic: boolean } {
  const lower = style.toLowerCase()
  const italic = lower.includes('italic')
  const clean = lower.replace(/italic/i, '').trim()
  return { weight: STYLE_NAME_TO_WEIGHT[clean] ?? 400, italic }
}
