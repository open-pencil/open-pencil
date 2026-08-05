import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { exportDeckFile } from '@open-pencil/core/io/formats/deck'

import { computeBodyId } from '@/app/storage/identity/body'

const fixturesDir = join(import.meta.dir, '../../../../fixtures/deck')

function loadDeck(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, name)))
}

/** Open a `.deck` the way the app does, then save it back with no edits. */
async function openAndSave(name: string, bytes: Uint8Array): Promise<Uint8Array> {
  const io = new IORegistry(BUILTIN_IO_FORMATS)
  const { graph, sourceFormat } = await io.readDocument({ name, data: bytes })
  expect(sourceFormat).toBe('deck')
  return exportDeckFile(graph, undefined, undefined, undefined, false, name)
}

/**
 * A document nobody edited must keep its body id.
 *
 * Cloud sync uploads whenever the body id moves, so an unstable round trip bills the
 * user for every open-and-close of an untouched deck. It used to move every cycle:
 * import minted fresh guids for each page and artboard, export sized the slide
 * scaffolding counter off them, and the whole file was renumbered on each save.
 */
describe('deck open/save body identity', () => {
  test.each(['font-variation-probe.deck', 'tone-refinement-probe.deck'])(
    '%s keeps its body id across open/save cycles',
    async (name) => {
      const first = await openAndSave(name, loadDeck(name))
      const second = await openAndSave(name, first)
      const third = await openAndSave(name, second)

      const firstId = await computeBodyId(first, 'deck')
      expect(await computeBodyId(second, 'deck')).toBe(firstId)
      expect(await computeBodyId(third, 'deck')).toBe(firstId)
    },
    30_000
  )
})
