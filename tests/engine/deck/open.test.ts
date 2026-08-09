import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

const fixturesDir = join(import.meta.dir, '../../fixtures/deck')

function loadDeckBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, name)))
}

describe('deck open via IORegistry', () => {
  test('font-variation-probe opens as 1 page', async () => {
    const io = new IORegistry(BUILTIN_IO_FORMATS)
    const reader = io.findReader('font-variation-probe.deck')
    expect(reader?.id).toBe('deck')
    const { graph, sourceFormat } = await io.readDocument({
      name: 'font-variation-probe.deck',
      data: loadDeckBytes('font-variation-probe.deck')
    })
    expect(sourceFormat).toBe('deck')
    expect(graph.getPages()).toHaveLength(1)
    expect(graph.getPages()[0]?.childIds.length).toBeGreaterThan(0)
  })

  test('tone-refinement-probe opens as 38 pages', async () => {
    const io = new IORegistry(BUILTIN_IO_FORMATS)
    const { graph } = await io.readDocument({
      name: 'tone-refinement-probe.deck',
      data: loadDeckBytes('tone-refinement-probe.deck')
    })
    expect(graph.getPages()).toHaveLength(38)
    expect(graph.images.size).toBeGreaterThan(0)
  })
})
