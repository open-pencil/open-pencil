import { expectDefined } from '#test-support/assert'
import { readFixture } from '#test-support/fig/fixtures'
import { capturedFigRecordsSchema } from '#test-support/fig/schema'

import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const fixture = readFixture('nested-binding-ownership-records.json', capturedFigRecordsSchema)

/** Remove only the placed owner's declaration, retaining the saved inherited expression. */
export function inheritedNestedBindingRecords(): NodeChange[] {
  const changes = structuredClone(fixture.nodeChanges)
  const owner = expectDefined(
    changes.find((node) => node.guid?.sessionID === 293733 && node.guid.localID === 8),
    'captured owner'
  )
  for (const override of symbolOverridesOf(owner)) {
    Reflect.deleteProperty(override, 'parameterConsumptionMap')
  }
  return changes
}
