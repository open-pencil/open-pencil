import { describe, expect, test } from 'bun:test'

import { expandWithBoth, openWithCrate } from '#fig-tests/helpers/fig-crate'
import { figArchiveOf } from '#fig-tests/helpers/fig-fixtures'
import { parseFigBuffer } from '#fig/archive/index'
import { deflateSync, unzipSync } from 'fflate'

import {
  buildFigKiwi,
  decompressFigKiwiData,
  parseFigKiwiChunks
} from '@open-pencil/kiwi/fig/container'
import { readFixtureArrayBuffer, readFixtureBytes } from '@open-pencil/test-support/paths'

/** A component property definition as far as these tests change it. */
interface TypedDefault {
  varValue?: { value?: { slotContentIdValue?: unknown; boolValue?: boolean } }
}

/** gold-preview's canvas with its message compressed by `compress`. */
function recompressed(compress: (message: Uint8Array) => Uint8Array): Uint8Array {
  const { 'canvas.fig': canvas } = unzipSync(readFixtureBytes('gold-preview.fig'), {
    filter: ({ name }) => name === 'canvas.fig'
  })
  const [schema, message] = parseFigKiwiChunks(canvas) ?? []
  if (!schema || !message) throw new Error('gold-preview.fig holds no canvas')
  return buildFigKiwi(schema, decompressFigKiwiData(message), undefined, compress)
}

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

  test('opens a canvas whose message is deflated, or split across Zstandard frames', async () => {
    const expected = (await openWithCrate(readFixtureBytes('gold-preview.fig'))).expand(1)
    const deflated = await openWithCrate(recompressed((message) => deflateSync(message)))
    expect(deflated.expand(1).occurrences).toEqual(expected.occurrences)
    const half = (message: Uint8Array) => Math.floor(message.length / 2)
    const framed = await openWithCrate(
      recompressed((message) => {
        const first = Bun.zstdCompressSync(message.subarray(0, half(message)))
        const second = Bun.zstdCompressSync(message.subarray(half(message)))
        const joined = new Uint8Array(first.length + second.length)
        joined.set(first)
        joined.set(second, first.length)
        return joined
      })
    )
    expect(framed.expand(1).occurrences).toEqual(expected.occurrences)
  })

  test('places the slot content a typed default names beside a boolean', async () => {
    const records = parseFigBuffer(readFixtureArrayBuffer('slots.fig')).nodeChanges
    // The file's slot defaults name no content; point one at a content frame and give it a
    // boolean too, as a typed default may hold both.
    const content = records.find((record) => record.isSlotContent === true)?.guid
    const definition = records
      .flatMap((record) =>
        Array.isArray(record.componentPropDefs) ? (record.componentPropDefs as TypedDefault[]) : []
      )
      .find((candidate) => candidate.varValue?.value?.slotContentIdValue)
    if (!content || !definition?.varValue) throw new Error('slots.fig has no slot default')
    definition.varValue.value = { slotContentIdValue: { guid: content }, boolValue: true }
    const { pages } = await expandWithBoth(new Uint8Array(await figArchiveOf(records)))
    for (const { id, difference } of pages)
      expect({ id, difference }).toEqual({ id, difference: null })
  })

  test('rejects a file that is not a .fig file', async () => {
    await expect(openWithCrate(new TextEncoder().encode('not a design'))).rejects.toThrow(
      'not a .fig file'
    )
  })
})
