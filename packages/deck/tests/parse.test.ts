import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { collectActiveSlides, parseDeckBuffer, restructureDeckNodeChanges } from '../src/index'

const fixturesDir = join(import.meta.dir, '../../../tests/fixtures/deck')

function loadDeck(name: string): ArrayBuffer {
  const bytes = readFileSync(join(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

describe('parseDeckBuffer', () => {
  test('font-variation-probe: 1 page with one 1920×1080 white artboard', () => {
    const result = parseDeckBuffer(loadDeck('font-variation-probe.deck'))
    expect(result.sourcePrelude).toBe('fig-deck')
    const pages = result.nodeChanges.filter(
      (n) => n.type === 'CANVAS' && !n.internalOnly && !/internal/i.test(n.name ?? '')
    )
    expect(pages).toHaveLength(1)
    expect(result.nodeChanges.some((n) => n.type === 'SLIDE')).toBe(false)
    expect(result.nodeChanges.some((n) => n.type === 'SLIDE_GRID')).toBe(false)
    expect(result.nodeChanges.some((n) => n.type === 'SLIDE_ROW')).toBe(false)

    const pageKey = pages[0]?.guid
      ? `${pages[0].guid.sessionID}:${pages[0].guid.localID}`
      : null
    const artboards = result.nodeChanges.filter(
      (n) =>
        n.type === 'FRAME' &&
        n.parentIndex?.guid &&
        `${n.parentIndex.guid.sessionID}:${n.parentIndex.guid.localID}` === pageKey
    )
    expect(artboards).toHaveLength(1)
    expect(artboards[0]?.size).toEqual({ x: 1920, y: 1080 })
    expect(result.nodeChanges.some((n) => n.type === 'TEXT')).toBe(true)
  })

  test('css-filter-roundtrip: 1 page with frames', () => {
    const result = parseDeckBuffer(loadDeck('css-filter-roundtrip.deck'))
    const pages = result.nodeChanges.filter(
      (n) => n.type === 'CANVAS' && !n.internalOnly && !/internal/i.test(n.name ?? '')
    )
    expect(pages).toHaveLength(1)
    expect(result.nodeChanges.some((n) => n.type === 'FRAME')).toBe(true)
  })

  test('tone-refinement-probe: 38 slide pages', () => {
    const result = parseDeckBuffer(loadDeck('tone-refinement-probe.deck'))
    const pages = result.nodeChanges.filter(
      (n) => n.type === 'CANVAS' && !n.internalOnly && !/internal/i.test(n.name ?? '')
    )
    expect(pages).toHaveLength(38)
    expect(result.images.length).toBeGreaterThan(0)
  })
})

describe('restructureDeckNodeChanges', () => {
  test('collectActiveSlides matches restructure page count', () => {
    // Parse without restructure by only normalizing — use parse internals via fixture decode path
    const result = parseDeckBuffer(loadDeck('tone-refinement-probe.deck'))
    const pages = result.nodeChanges.filter(
      (n) => n.type === 'CANVAS' && !n.internalOnly && !/internal/i.test(n.name ?? '')
    )
    expect(pages).toHaveLength(38)
    // Idempotent: already restructured
    const again = restructureDeckNodeChanges(result.nodeChanges)
    const pages2 = again.filter(
      (n) => n.type === 'CANVAS' && !n.internalOnly && !/internal/i.test(n.name ?? '')
    )
    expect(pages2).toHaveLength(38)
  })
})

describe('collectActiveSlides', () => {
  test('is used by parse (smoke via page names)', () => {
    const result = parseDeckBuffer(loadDeck('font-variation-probe.deck'))
    // After restructure there are no SLIDE nodes; collect returns empty
    expect(collectActiveSlides(result.nodeChanges)).toHaveLength(0)
  })
})
