import type { TextDecoration } from '#core/scene-graph'

export function mapTextDecoration(d?: string): TextDecoration {
  switch (d) {
    case 'UNDERLINE':
      return 'UNDERLINE'
    case 'STRIKETHROUGH':
      return 'STRIKETHROUGH'
    default:
      return 'NONE'
  }
}

export function convertLineHeight(
  lh?: { value: number; units: string },
  fontSize?: number
): number | null {
  if (!lh) return null
  if (lh.units === 'PIXELS') return lh.value
  if (lh.units === 'PERCENT') return (lh.value / 100) * (fontSize ?? 14)
  if (lh.units === 'RAW') return lh.value * (fontSize ?? 14)
  return null
}

export function convertLetterSpacing(
  ls?: { value: number; units: string },
  fontSize?: number
): number {
  if (!ls) return 0
  if (ls.units === 'PIXELS') return ls.value
  if (ls.units === 'PERCENT') return (ls.value / 100) * (fontSize ?? 14)
  return ls.value
}
