import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { expectDefined } from '@open-pencil/test-support/assert'
/** Remove only the placed owner's declaration, retaining the saved inherited expression. */

import fixture from '#tests/fixtures/nested-binding-ownership-records.json' with { type: 'json' }
export function inheritedNestedBindingRecords(): NodeChange[] {
  const changes = structuredClone(fixture.nodeChanges) as NodeChange[]
  const owner = expectDefined(
    changes.find((node) => node.guid?.sessionID === 293733 && node.guid.localID === 8),
    'captured owner'
  )
  for (const override of symbolOverridesOf(owner)) {
    Reflect.deleteProperty(override, 'parameterConsumptionMap')
  }
  return changes
}
