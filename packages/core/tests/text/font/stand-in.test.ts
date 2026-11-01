import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  documentFontStatus,
  FontManager,
  fontTableView,
  sfntFont
} from '@open-pencil/core/text'
import { FONT_STAND_INS, standInFont } from '#core/text/font/stand-in'

const FIGMA_HAND = FONT_STAND_INS['Figma Hand']

/** A font manager that asks no web provider, so a missing family can only fall to its stand-in. */
function offlineManager() {
  const manager = new FontManager()
  manager.setOnlineFontProviders({})
  return manager
}

async function bundledCaveat() {
  const manager = offlineManager()
  const file = await manager.fetchBundledFont(FIGMA_HAND.file)
  if (!file) throw new Error('Caveat is not bundled')
  return sfntFont(file)
}

describe('stand-in fonts', () => {
  test("Caveat stands in for Figma Hand at its widths, in Figma Hand's line box", async () => {
    const caveat = await bundledCaveat()
    const font = standInFont(caveat, FIGMA_HAND)
    if (!font) throw new Error('No stand-in font')
    const unitsPerEm = fontTableView(font, 'head')?.getUint16(18) ?? 0
    // Caveat's 1000-unit em, made 1.69 times smaller, so its letters are 1.69 times wider.
    expect(unitsPerEm).toBe(592)
    const hhea = fontTableView(font, 'hhea')
    expect([hhea?.getInt16(4), hhea?.getInt16(6), hhea?.getInt16(8)]).toEqual([604, -213, 0])
    // The file it was made from is left as it was.
    expect(fontTableView(caveat, 'head')?.getUint16(18)).toBe(1000)
  })

  test('a page served in place of the file is not taken for a font', () => {
    const page = new TextEncoder().encode('<!doctype html><title>Not found</title>').buffer
    expect(standInFont(page, FIGMA_HAND)).toBeNull()
  })

  test('a missing Figma Hand loads the stand-in under its own name, reported as Caveat', async () => {
    const manager = offlineManager()
    const font = await manager.loadFont('Figma Hand', 'Regular')
    expect(font).not.toBeNull()
    expect(manager.loadedFontSource('Figma Hand', 'Regular')).toBe('stand-in')

    const graph = new SceneGraph()
    const pageId = graph.getPages()[0]?.id ?? graph.rootId
    graph.createNode('TEXT', pageId, { fontFamily: 'Figma Hand', fontWeight: 400, text: 'Hi' })
    const [face] = documentFontStatus(graph, pageId, manager).issues
    expect(face).toMatchObject({ family: 'Figma Hand', status: 'substituted', substituteFamily: 'Caveat' })
  })

  test('other missing families have no stand-in', async () => {
    expect(await offlineManager().loadFont('No Such Family', 'Regular')).toBeNull()
  })

  test('a font whose head table is cut short is not taken for one', async () => {
    const caveat = await bundledCaveat()
    const view = new DataView(caveat)
    // Shorten the head table's directory record to 4 bytes, too short for the em it holds.
    for (let i = 0; i < view.getUint16(4); i++) {
      const record = 12 + i * 16
      const tag = String.fromCharCode(...new Uint8Array(caveat, record, 4))
      if (tag === 'head') view.setUint32(record + 12, 4)
    }
    expect(standInFont(caveat, FIGMA_HAND)).toBeNull()
  })

  test('an installed Figma Hand replaces the stand-in once it can be read', async () => {
    const manager = offlineManager()
    await manager.loadFont('Figma Hand', 'Regular')
    const installed = await bundledCaveat()
    manager.setHostFontLoader((family) => Promise.resolve(family === 'Figma Hand' ? installed : null))
    await manager.loadFont('Figma Hand', 'Regular')
    expect(manager.loadedFontSource('Figma Hand', 'Regular')).toBe('local')
  })
})
