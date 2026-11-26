import { describe, expect, test } from 'bun:test'

import { expandWithBoth, openWithCrate } from '#fig-tests/helpers/fig-crate'
import { unzipSync } from 'fflate'

import { readFixtureBytes } from '@open-pencil/test-support/paths'

const FIXTURES = [
  'gold-preview.fig',
  'slots.fig',
  'variable-override-precedence.fig',
  'circle-text.fig'
]

describe('the Rust reader', () => {
  for (const name of FIXTURES) {
    test(`expands every page of ${name} into the tree the TypeScript reader builds`, async () => {
      const { pageIds, pages } = await expandWithBoth(readFixtureBytes(name))
      expect(pageIds.crate.toSorted()).toEqual(pageIds.reader.toSorted())
      for (const { id, difference, missingComponents } of pages) {
        expect({ id, difference }).toEqual({ id, difference: null })
        expect(missingComponents.crate).toBe(missingComponents.reader)
      }
    })
  }

  test('opens a bare canvas, as older files are saved, like the archive holding it', async () => {
    const archive = readFixtureBytes('gold-preview.fig')
    const { 'canvas.fig': canvas } = unzipSync(archive, {
      filter: ({ name }) => name === 'canvas.fig'
    })
    const bare = await openWithCrate(canvas)
    const zipped = await openWithCrate(archive)
    expect(bare.pageIds).toEqual(zipped.pageIds)
    expect(bare.expand(1).occurrences).toEqual(zipped.expand(1).occurrences)
  })

  test('rejects a file that is not a .fig file', async () => {
    await expect(openWithCrate(new TextEncoder().encode('not a design'))).rejects.toThrow(
      'not a .fig file'
    )
  })
})
