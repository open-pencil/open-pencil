import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { unzipSync } from 'fflate'

import type { GUID } from '@open-pencil/kiwi/fig/codec'
import { decodeFigKiwiCanvas } from '@open-pencil/kiwi/fig/parse'

import {
  collectActiveSlides,
  normalizeDeckCanvasPrelude,
  parseDeckBuffer,
  restructureDeckNodeChanges,
  structurePagesToDeck
} from '../src/index'

const fixturesDir = join(import.meta.dir, '../../../tests/fixtures/deck')
const DECK_FIXTURES = [
  'font-variation-probe.deck',
  'css-filter-roundtrip.deck',
  'tone-refinement-probe.deck'
]

function loadDeck(name: string): ArrayBuffer {
  const bytes = readFileSync(join(fixturesDir, name))
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

function guidKey(guid: GUID | undefined): string {
  return guid ? `${guid.sessionID}:${guid.localID}` : '-'
}

/** Slide guids as the source archive stores them, before any restructuring. */
function sourceSlideGuids(name: string): string[] {
  const canvas = unzipSync(new Uint8Array(loadDeck(name)))['canvas.fig']
  if (!canvas) throw new Error(`${name} has no canvas.fig`)
  const decoded = decodeFigKiwiCanvas(normalizeDeckCanvasPrelude(canvas))
  return collectActiveSlides(decoded.nodeChanges).map((slide) => guidKey(slide.guid))
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

  /**
   * Opening a deck and saving it again must produce the same nodes. Import used to mint
   * a fresh guid for every page and artboard, and export sized the scaffolding counter
   * off those guids, so each open/save cycle renumbered every slide. The archive changed
   * with zero user edits and re-uploaded to cloud storage on every close.
   */
  describe.each(DECK_FIXTURES)('%s round-trips without renumbering', (fixture) => {
    test('slides keep the guids the source archive stored', () => {
      const opened = parseDeckBuffer(loadDeck(fixture))
      const structured = structurePagesToDeck(opened.nodeChanges)
      expect(collectActiveSlides(structured).map((s) => guidKey(s.guid))).toEqual(
        sourceSlideGuids(fixture)
      )
    })

    test('a second open/save cycle produces identical NodeChanges', () => {
      const first = structurePagesToDeck(parseDeckBuffer(loadDeck(fixture)).nodeChanges)
      const second = structurePagesToDeck(restructureDeckNodeChanges(first))
      expect(second).toEqual(first)
    })

    test('guids stay unique after the artboard reclaims the slide guid', () => {
      const structured = structurePagesToDeck(parseDeckBuffer(loadDeck(fixture)).nodeChanges)
      const keys = structured.filter((n) => n.guid).map((n) => guidKey(n.guid))
      expect(new Set(keys).size).toBe(keys.length)
    })
  })
})
