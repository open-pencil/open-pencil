import type { NodeChange, StyleReference } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { forEachOverrideRecord } from '../instance-overrides/types'

export const STYLE_REFERENCE_FIELDS = [
  'styleIdForFill',
  'styleIdForStrokeFill',
  'styleIdForText',
  'styleIdForEffect',
  'styleIdForGrid'
] as const

/** A vector's style table, whose region entries name a fill style as a record does. */
export function vectorStyleTable(node: NodeChange): NodeChange[] {
  const vectorData = node.vectorData as { styleOverrideTable?: NodeChange[] } | undefined
  return vectorData?.styleOverrideTable ?? []
}

/**
 * Include available style definitions, including references declared on override paths, by
 * ranges of text, and by a vector's regions.
 */
export function styleDependencies(
  node: NodeChange,
  resolve: (reference: StyleReference) => string | undefined,
  available: ReadonlySet<string>
): Set<string> {
  const result = new Set<string>()
  forEachOverrideRecord(node, (source) => {
    // Ranges of a text and regions of a vector name their styles in a style table, as the record
    // names its own.
    for (const record of [
      source,
      ...(source.textData?.styleOverrideTable ?? []),
      ...vectorStyleTable(source)
    ]) {
      for (const field of STYLE_REFERENCE_FIELDS) {
        const reference = record[field]
        if (!reference) continue
        const id = reference.guid ? guidToString(reference.guid) : resolve(reference)
        if (id && available.has(id)) result.add(id)
      }
    }
  })
  return result
}
