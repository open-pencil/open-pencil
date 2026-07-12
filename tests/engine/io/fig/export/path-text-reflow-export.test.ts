import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

import { parseFigBuffer } from '@open-pencil/kiwi/fig/parse'

import { exportFigFile } from '#core/io/formats/fig/export'
import { parseFigFile } from '#core/io/formats/fig/read'
import {
  calibratePathTextLayout,
  getTextPathData,
  reflowPathTextGlyphs
} from '#core/text/path-layout'

import { expectDefined } from '#tests/helpers/assert'

const LOCAL_CIRCLE_TEXT = 'tests/fixtures/circle-text.fig'

async function loadFixtureGraph() {
  const bytes = readFileSync(LOCAL_CIRCLE_TEXT)
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  return parseFigFile(ab)
}

describe('TEXT_PATH reflow export hygiene (optional local)', () => {
  test('reflowed node exports no strokeGeometry and reflowed glyph positions', async () => {
    if (!existsSync(LOCAL_CIRCLE_TEXT)) {
      console.log('skip: ArnoWithCircleText.fig not present')
      return
    }

    const graph = await loadFixtureGraph()
    const node = expectDefined(
      [...graph.getAllNodes()].find((n) => n.name === 'ArnoCoenen.art'),
      'path text node'
    )
    const data = expectDefined(getTextPathData(node), 'text path data')
    const box = expectDefined(node.textPathBox, 'textPathBox')
    const origGlyphs = expectDefined(node.figmaDerivedTextGlyphs, 'imported glyphs')
    const layout = expectDefined(calibratePathTextLayout(origGlyphs, data, box), 'layout')
    const halfBox = {
      x: box.x * 0.5,
      y: box.y * 0.5,
      width: box.width * 0.5,
      height: box.height * 0.5
    }
    const reflowed = expectDefined(
      reflowPathTextGlyphs(origGlyphs, data, layout, halfBox),
      'reflowed glyphs'
    )
    // Sanity: reflow at half size must actually move the glyphs.
    expect(reflowed.some((g, i) => Math.abs(g.x - origGlyphs[i].x) > 1)).toBe(true)

    // Simulate the state resize.ts's reflow leaves behind: scene strokeGeometry
    // emptied while rawNodeFields still holds the ORIGINAL baked silhouettes
    // plus vectorData/textPathStart. preserveSourceMetadataDuring keeps the raw
    // fields — a bare updateNode would wipe them (clearEditedSourceMetadata)
    // and hide exactly the stale-silhouette fallback this test guards against.
    graph.preserveSourceMetadataDuring(() => {
      graph.updateNode(node.id, {
        strokeGeometry: [],
        textPathBox: halfBox,
        figmaDerivedTextGlyphs: reflowed
      })
    })
    const updated = expectDefined(graph.getNode(node.id), 'updated node')
    expect(updated.strokeGeometry.length).toBe(0)
    expect('strokeGeometry' in updated.source.fig.rawNodeFields).toBe(true)

    const out = await exportFigFile(graph)
    const reparsed = parseFigBuffer(out)
    const exported = expectDefined(
      reparsed.nodeChanges.find((nc) => nc.name === 'ArnoCoenen.art'),
      'exported node change'
    )
    expect(exported.type).toBe('TEXT_PATH')

    // No strokeGeometry at all: neither from the (empty) scene field nor from
    // stale rawNodeFields — silhouettes are re-derived from the glyphs.
    expect(exported.strokeGeometry).toBeUndefined()

    // derivedTextData carries the reflowed positions, not raw pre-resize ones.
    const glyphs = expectDefined(exported.derivedTextData?.glyphs, 'exported glyphs')
    expect(glyphs.length).toBe(reflowed.length)
    for (let i = 0; i < reflowed.length; i++) {
      expect(expectDefined(glyphs[i]?.position?.x)).toBeCloseTo(reflowed[i].x, 2)
      expect(expectDefined(glyphs[i]?.position?.y)).toBeCloseTo(reflowed[i].y, 2)
    }

    // The layout path payload survives so reimport can reflow again.
    const rawExported = exported as typeof exported & Record<string, unknown>
    expect(rawExported.vectorData).toBeDefined()
    expect(rawExported.textPathStart).toBeDefined()
  })

  test('unmodified fixture still round-trips WITH strokeGeometry', async () => {
    if (!existsSync(LOCAL_CIRCLE_TEXT)) {
      console.log('skip: ArnoWithCircleText.fig not present')
      return
    }

    const graph = await loadFixtureGraph()
    const out = await exportFigFile(graph)
    const reparsed = parseFigBuffer(out)
    const exported = expectDefined(
      reparsed.nodeChanges.find((nc) => nc.name === 'ArnoCoenen.art'),
      'exported node change'
    )
    expect(exported.type).toBe('TEXT_PATH')
    expect(exported.strokeGeometry?.length ?? 0).toBeGreaterThan(0)
  })
})
