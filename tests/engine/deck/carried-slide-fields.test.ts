import { describe, expect, test } from 'bun:test'

import { restructureDeckNodeChanges, structurePagesToDeck } from '@open-pencil/deck'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'

const NOTE = 'Remember to mention the exposure curve here.'

/**
 * A deck's slide becomes a page on import and a slide again on export. Speaker notes and
 * transitions are authored content with nowhere to live in the scene graph, so they ride
 * along as raw fields — losing them would be silent data loss on open-and-save.
 */
function deckWithOneSlide(extra: Partial<NodeChange> = {}): NodeChange[] {
  return [
    { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Document', phase: 'CREATED' },
    {
      guid: { sessionID: 0, localID: 1 },
      type: 'CANVAS',
      name: 'Page 1',
      phase: 'CREATED',
      parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }
    },
    {
      guid: { sessionID: 0, localID: 3 },
      type: 'SLIDE_GRID',
      name: 'Presentation',
      phase: 'CREATED',
      parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' }
    },
    {
      guid: { sessionID: 0, localID: 4 },
      type: 'SLIDE_ROW',
      name: 'Row',
      phase: 'CREATED',
      parentIndex: { guid: { sessionID: 0, localID: 3 }, position: '!' }
    },
    {
      guid: { sessionID: 1, localID: 24 },
      type: 'SLIDE',
      name: '1',
      phase: 'CREATED',
      parentIndex: { guid: { sessionID: 0, localID: 4 }, position: '!' },
      size: { x: 1920, y: 1080 },
      ...extra
    }
  ] as NodeChange[]
}

describe('carried slide fields', () => {
  test('speaker notes survive the page round-trip', () => {
    const imported = restructureDeckNodeChanges(deckWithOneSlide({ slideSpeakerNotes: NOTE }))
    const page = imported.find((nc) => nc.type === 'CANVAS' && !nc.internalOnly)
    expect(page?.slideSpeakerNotes).toBe(NOTE)

    const exported = structurePagesToDeck(imported)
    const slide = exported.find((nc) => nc.type === 'SLIDE')
    expect(slide?.slideSpeakerNotes).toBe(NOTE)
  })

  test('slide identity fields survive the page round-trip', () => {
    const overrideKey = { sessionID: 7, localID: 42 }
    const imported = restructureDeckNodeChanges(deckWithOneSlide({ overrideKey }))
    const exported = structurePagesToDeck(imported)

    expect(exported.find((nc) => nc.type === 'SLIDE')?.overrideKey).toEqual(overrideKey)
  })

  test('slide-only fields do not leak onto exported canvases', () => {
    const imported = restructureDeckNodeChanges(deckWithOneSlide({ slideSpeakerNotes: NOTE }))
    const exported = structurePagesToDeck(imported)

    for (const canvas of exported.filter((nc) => nc.type === 'CANVAS')) {
      expect(canvas.slideSpeakerNotes).toBeUndefined()
    }
  })

  test('a slide without notes stays without them', () => {
    const imported = restructureDeckNodeChanges(deckWithOneSlide())
    const exported = structurePagesToDeck(imported)

    expect(exported.find((nc) => nc.type === 'SLIDE')?.slideSpeakerNotes).toBeUndefined()
  })
})
