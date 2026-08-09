import { describe, expect, test } from 'bun:test'

import { unzipSync } from 'fflate'

import { exportDeckFile } from '@open-pencil/core/io/formats/deck'
import { importNodeChanges } from '@open-pencil/core/kiwi/fig/import'
import {
  addEmptySlide,
  createEmptyDeckGraph,
  getSlideSpeakerNotes,
  normalizeDeckCanvasPrelude,
  restructureDeckNodeChanges,
  setSlideSpeakerNotes,
  speakerNotesPlainText
} from '@open-pencil/deck'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { decodeFigKiwiCanvas } from '@open-pencil/kiwi/fig/parse'

const NOTES_ONE = 'Remember to mention the exposure curve here.'
const NOTES_TWO = 'Pause before the pricing slide.'

/**
 * Notes as a person reads them, not as the field stores them.
 *
 * The field carries a serialised Lexical editor state — that is the format the
 * exporting application defines — so asserting raw string equality would pin
 * the serialisation rather than the behaviour under test: that each slide keeps
 * its own note across a save.
 */
function slideNotesIn(bytes: Uint8Array): (string | undefined)[] {
  const decoded = decodeFigKiwiCanvas(normalizeDeckCanvasPrelude(unzipSync(bytes)['canvas.fig']))
  return decoded.nodeChanges
    .filter((nc) => nc.type === 'SLIDE')
    .map((nc) =>
      typeof nc.slideSpeakerNotes === 'string'
        ? speakerNotesPlainText(nc.slideSpeakerNotes)
        : nc.slideSpeakerNotes
    )
}

describe('slide speaker notes', () => {
  test('writing notes and reparsing a saved deck preserves them per slide', async () => {
    const graph = createEmptyDeckGraph()
    const pages = graph.getPages()
    const first = graph.getNode(pages[0].id)
    const second = graph.getNode(addEmptySlide(graph))
    if (!first || !second) throw new Error('expected pages to exist')

    setSlideSpeakerNotes(first, NOTES_ONE)
    setSlideSpeakerNotes(second, NOTES_TWO)

    const bytes = await exportDeckFile(
      graph,
      undefined,
      undefined,
      pages[0].id,
      false,
      'notes.deck'
    )
    expect(slideNotesIn(bytes)).toEqual([NOTES_ONE, NOTES_TWO])
  })

  test('notes on a slide created with New slide survive a round-trip', async () => {
    const graph = createEmptyDeckGraph()
    const added = addEmptySlide(graph, { name: 'New slide' })
    const addedNode = graph.getNode(added)
    if (!addedNode) throw new Error('expected the added page to exist')

    setSlideSpeakerNotes(addedNode, NOTES_TWO)

    const bytes = await exportDeckFile(graph, undefined, undefined, added, false, 'notes.deck')
    const restructured = restructureDeckNodeChanges(
      decodeFigKiwiCanvas(normalizeDeckCanvasPrelude(unzipSync(bytes)['canvas.fig'])).nodeChanges
    )
    const reimported = importNodeChanges(restructured, [], new Map())

    const page = reimported.getPages().find((p) => p.name === 'New slide')
    expect(getSlideSpeakerNotes(page)).toBe(NOTES_TWO)
  })

  test('clearing notes removes the field so a slide stays without them', async () => {
    const graph = createEmptyDeckGraph()
    const page = graph.getPages()[0]

    setSlideSpeakerNotes(page, NOTES_ONE)
    expect(getSlideSpeakerNotes(page)).toBe(NOTES_ONE)

    setSlideSpeakerNotes(page, '')
    expect(getSlideSpeakerNotes(page)).toBe('')

    const bytes = await exportDeckFile(graph, undefined, undefined, page.id, false, 'notes.deck')
    expect(slideNotesIn(bytes).every((notes) => notes === undefined)).toBe(true)
  })

  test('notes read back from an imported deck', async () => {
    const graph = createEmptyDeckGraph()
    const pages = graph.getPages()
    const first = graph.getNode(pages[0].id)
    if (!first) throw new Error('expected the page to exist')

    setSlideSpeakerNotes(first, NOTES_ONE)
    const bytes = await exportDeckFile(
      graph,
      undefined,
      undefined,
      pages[0].id,
      false,
      'notes.deck'
    )

    const nodeChanges: NodeChange[] = restructureDeckNodeChanges(
      decodeFigKiwiCanvas(normalizeDeckCanvasPrelude(unzipSync(bytes)['canvas.fig'])).nodeChanges
    )
    const reimported = importNodeChanges(nodeChanges, [], new Map())
    const page = reimported.getPages()[0]
    expect(getSlideSpeakerNotes(page)).toBe(NOTES_ONE)
  })
})
