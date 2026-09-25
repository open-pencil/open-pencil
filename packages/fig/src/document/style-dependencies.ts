import type { NodeChange, StyleReference } from '@open-pencil/kiwi/fig/codec'
import { guidToString } from '@open-pencil/kiwi/fig/guid'

import { forEachOverrideRecord } from '../instance-overrides/types'

const STYLE_REFERENCE_FIELDS = [
  'styleIdForFill',
  'styleIdForStrokeFill',
  'styleIdForText',
  'styleIdForEffect',
  'styleIdForGrid'
] as const

/** Include available style definitions, including references declared on override paths. */
export function styleDependencies(
  node: NodeChange,
  resolve: (reference: StyleReference) => string | undefined,
  available: ReadonlySet<string>
): Set<string> {
  const result = new Set<string>()
  forEachOverrideRecord(node, (source) => {
    for (const field of STYLE_REFERENCE_FIELDS) {
      const reference = source[field]
      if (!reference) continue
      const id = reference.guid ? guidToString(reference.guid) : resolve(reference)
      if (id && available.has(id)) result.add(id)
    }
  })
  return result
}
