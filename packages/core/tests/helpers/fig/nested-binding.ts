import type { SymbolData } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { expectDefined } from '../assert'
import { CapturedFigRecords, readFixture } from './fixtures'

const fixture = readFixture('nested-binding-ownership-records.json', CapturedFigRecords)

/** Remove only the placed owner's declaration, retaining the saved inherited expression. */
export function inheritedNestedBindingRecords(): NodeChange[] {
  const changes = structuredClone(fixture.nodeChanges)
  const owner = expectDefined(
    changes.find((node) => node.guid?.sessionID === 293733 && node.guid.localID === 8),
    'captured owner'
  )
  for (const override of (owner.symbolData as SymbolData).symbolOverrides ?? []) {
    Reflect.deleteProperty(override, 'parameterConsumptionMap')
  }
  return changes
}
