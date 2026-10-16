import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { isUnsetGuid } from '@open-pencil/kiwi/fig/guid'

import type { InstanceOccurrence } from './occurrence/types'

function isClearedStyleReference(reference: NodeChange['styleIdForFill']): boolean {
  return reference?.guid !== undefined && isUnsetGuid(reference.guid)
}

/**
 * An outer instance that clears a fill style an intermediate component applied to a nested layer
 * claims the unset style reference and writes no `fillPaints`: the layer shows the fill of the
 * component it comes from again. The claim is rewritten to carry that record's own fill (and
 * style), so the intermediate component's fill does not stay on the layer. A claim that carries
 * `fillPaints` of its own keeps them.
 */
export function revertClearedFillStyle(
  target: InstanceOccurrence,
  claim: Partial<NodeChange>,
  source: NodeChange | undefined
): void {
  if (!isClearedStyleReference(claim.styleIdForFill) || 'fillPaints' in claim) return
  delete claim.styleIdForFill
  delete target.properties.styleIdForFill
  if (source?.fillPaints) claim.fillPaints = structuredClone(source.fillPaints)
  if (source?.styleIdForFill)
    target.properties.styleIdForFill = structuredClone(source.styleIdForFill)
}
