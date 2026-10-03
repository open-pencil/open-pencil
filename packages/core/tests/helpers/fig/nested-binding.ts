import type { SymbolData } from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

import { expectDefined } from '../assert'
import { readFixtureJSON } from './fixtures'

const fixture = readFixtureJSON<Record<string, unknown>[]>('nested-binding-ownership-records.json')

/** Remove only the placed owner's declaration, retaining the saved inherited expression. */
export function inheritedNestedBindingRecords(): NodeChange[] {
  const changes = structuredClone(fixture.nodeChanges) as NodeChange[]
  const owner = expectDefined(
    changes.find((node) => node.guid?.sessionID === 293733 && node.guid.localID === 8),
    'captured owner'
  )
  for (const override of (owner.symbolData as SymbolData).symbolOverrides ?? []) {
    Reflect.deleteProperty(override, 'parameterConsumptionMap')
  }
  return changes
}
