import { expect, test } from 'bun:test'

import { expandWithBoth } from '#fig-tests/helpers/fig-crate'

import { runsHeavyTests } from '@open-pencil/test-support/heavy'
import { readFixtureBytes } from '@open-pencil/test-support/paths'

// A design kit of 34 pages and 87,000 records, with nested instances, swaps, and variants.
test.if(runsHeavyTests)(
  'the Rust reader expands every page of material3.fig as the TypeScript reader does',
  async () => {
    const { pageIds, pages } = await expandWithBoth(readFixtureBytes('material3.fig'))
    expect(pageIds.crate.toSorted()).toEqual(pageIds.reader.toSorted())
    for (const { id, difference, missingComponents } of pages) {
      expect({ id, difference }).toEqual({ id, difference: null })
      expect(missingComponents.crate).toBe(missingComponents.reader)
    }
  },
  600_000
)
