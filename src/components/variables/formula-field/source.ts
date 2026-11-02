import type { ReferenceRange } from './dialects/types'

/** The source spelling stays intact when a reference is displayed as an atomic pill. */
export interface FormulaPill {
  label: string
  /** The variable's collection and current value, shown on hover. */
  tooltip: string
}

export interface FormulaSelection {
  start: number
  end: number
}

export interface FormulaSegment extends FormulaSelection {
  source: string
  pill?: FormulaPill
}

/** Keep offsets in source coordinates, even when a reference is displayed as a pill. */
export function formulaSegments(
  source: string,
  references: readonly ReferenceRange[],
  resolve: (reference: string) => FormulaPill | undefined
) {
  const segments: FormulaSegment[] = []
  let start = 0
  for (const token of references) {
    const pill = resolve(token.source)
    if (!pill) continue
    if (start < token.from)
      segments.push({ source: source.slice(start, token.from), start, end: token.from })
    segments.push({ source: token.source, start: token.from, end: token.to, pill })
    start = token.to
  }
  segments.push({ source: source.slice(start), start, end: source.length })
  return segments
}
