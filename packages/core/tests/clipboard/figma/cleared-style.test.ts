import { beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { expectDefined } from '#core-tests/helpers/assert'
import { FIXTURES } from '#core-tests/helpers/paths'

import { importClipboardNodes } from '@open-pencil/core/clipboard'
import { exportFigFile, parseFigFile, populateAllFigPages } from '@open-pencil/core/io/formats/fig'
import { parseFigmaClipboard } from '@open-pencil/fig/clipboard'
import { symbolOverridesOf } from '@open-pencil/fig/instance-overrides'
import { initCodec, type NodeChange, type StyleReference } from '@open-pencil/kiwi/fig/codec'
import { isUnsetGuid } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

/**
 * Outer instances of Middle, as Figma copies them. Middle holds an instance of Inner and styles
 * Inner's layer; Outer clears that style, and Figma writes the cleared reference together with
 * the values it governs, which keeps Middle's look.
 */
interface Case {
  fixture: string
  reference: keyof NodeChange
  layer: string
  read: (node: SceneNode) => object
  kept: object
  source: object
}

const CASES: Case[] = [
  {
    // Inner's Swatch is green with a paint style of its own; Middle gives it a blue style.
    fixture: 'clipboard/cleared-fill-style.html',
    reference: 'styleIdForFill',
    layer: 'Swatch',
    read: (node: SceneNode) => ({ color: node.fills[0]?.color, style: node.fillStyleId }),
    kept: { color: { r: 0, g: 0, b: 1, a: 1 }, style: null },
    source: { color: { r: 0, g: 1, b: 0, a: 1 }, style: null }
  },
  {
    // Inner's text is 12 Regular; Middle gives it a 40 Bold upper-case text style.
    fixture: 'clipboard/cleared-text-style.html',
    reference: 'styleIdForText',
    layer: 'Layer',
    read: (node: SceneNode) => ({
      size: node.fontSize,
      weight: node.fontWeight,
      textCase: node.textCase,
      style: node.textStyleId
    }),
    kept: { size: 40, weight: 700, textCase: 'UPPER', style: null },
    source: { size: 12, weight: 400, textCase: 'ORIGINAL', style: null }
  }
]

function isClearedReference(value: unknown): boolean {
  const guid = (value as StyleReference | undefined)?.guid
  return guid !== undefined && isUnsetGuid(guid)
}

/** A document saved as .fig and opened again. */
async function reopened(graph: SceneGraph): Promise<SceneGraph> {
  const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer, {
    populate: 'first-page'
  })
  populateAllFigPages(reopened)
  return reopened
}

/**
 * Outer's layer after import, or after a .fig save and reopen too; `valuesKept: false` leaves the
 * clearing claim only its reference.
 */
async function outerLayer(entry: Case, valuesKept: boolean, saved = false) {
  const parsed = expectDefined(
    await parseFigmaClipboard(await Bun.file(join(FIXTURES, entry.fixture)).text())
  )
  // Only Outer's clearing claim: Middle's own claim names the style it applies.
  if (!valuesKept)
    for (const override of parsed.nodes.flatMap(symbolOverridesOf))
      if (isClearedReference(override[entry.reference]))
        for (const field of Object.keys(override))
          if (field !== 'guidPath' && field !== entry.reference)
            Reflect.deleteProperty(override, field)
  const imported = new SceneGraph()
  importClipboardNodes(parsed.nodes, imported, imported.getPages()[0].id, 0, 0, parsed.blobs)
  const graph = saved ? await reopened(imported) : imported
  const outer = expectDefined([...graph.nodes.values()].find((node) => node.name === 'Outer')).id
  const layer = expectDefined(
    [...graph.nodes.values()].find(
      (node) => node.name === entry.layer && graph.isDescendant(node.id, outer)
    )
  )
  return entry.read(layer)
}

beforeAll(initCodec)

describe.each(CASES)('a $reference an outer instance clears', (entry) => {
  test('keeps the values Figma wrote with the clear', async () => {
    expect(await outerLayer(entry, true)).toEqual(entry.kept)
  })

  // Figma draws such a claim with Inner's values, and with no style (live-verified).
  test("shows the source layer's values, without a style, when it wrote none", async () => {
    expect(await outerLayer(entry, false)).toEqual(entry.source)
  })

  test('stays cleared through a .fig save and reopen', async () => {
    expect(await outerLayer(entry, true, true)).toEqual(entry.kept)
    expect(await outerLayer(entry, false, true)).toEqual(entry.source)
  })
})
