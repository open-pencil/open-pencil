import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { collectActiveSlides, parseDeckBuffer, structurePagesToDeck } from '../src/index'

const fixturesDir = join(import.meta.dir, '../../../tests/fixtures/deck')

function loadDeck(name: string): ArrayBuffer {
  const bytes = readFileSync(join(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe('structurePagesToDeck', () => {
  test('pages restructure back into SLIDE nodes', () => {
    const opened = parseDeckBuffer(loadDeck('font-variation-probe.deck'))
    const pages = opened.nodeChanges.filter(
      (n) => n.type === 'CANVAS' && !n.internalOnly && !/internal/i.test(n.name ?? '')
    )
    expect(pages).toHaveLength(1)

    const structured = structurePagesToDeck(opened.nodeChanges)
    expect(structured.some((n) => n.type === 'SLIDE_GRID')).toBe(true)
    expect(structured.some((n) => n.type === 'SLIDE_ROW')).toBe(true)
    const slides = collectActiveSlides(structured)
    expect(slides).toHaveLength(1)
  })

  test('38-page deck structures 38 slides', () => {
    const opened = parseDeckBuffer(loadDeck('tone-refinement-probe.deck'))
    const structured = structurePagesToDeck(opened.nodeChanges)
    expect(collectActiveSlides(structured)).toHaveLength(38)
  })
})
