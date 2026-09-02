import { afterEach, describe, expect, test } from 'bun:test'

import { presentExportImageTarget } from '@/app/automation/bridge/export-handlers'

const hadRequestAnimationFrame = 'requestAnimationFrame' in globalThis
const originalRequestAnimationFrame = globalThis.requestAnimationFrame

afterEach(() => {
  if (hadRequestAnimationFrame) {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame
  } else {
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
  }
})

function createTarget(currentPageId = 'page-1') {
  const events: string[] = []
  const selected: string[][] = []
  const state = { currentPageId }
  const target = {
    documentId: 'document-2',
    documentName: 'Document 2',
    pageId: 'page-2',
    pageName: 'Page 2',
    store: {
      state,
      graph: {
        getChildren: () => [{ id: 'frame-1' }, { id: 'frame-2' }]
      },
      switchPage: async (pageId: string) => {
        events.push(`switch:${pageId}`)
        state.currentPageId = pageId
      },
      select: (ids: string[]) => {
        events.push('select')
        selected.push(ids)
      },
      zoomToSelection: () => events.push('zoom')
    }
  }

  return { events, selected, target }
}

describe('MCP export image canvas presentation', () => {
  test('activates the document and page, fits requested nodes, then waits two frames', async () => {
    const frames: FrameRequestCallback[] = []
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback)
      return frames.length
    }
    const { events, selected, target } = createTarget()

    const presentation = presentExportImageTarget(target, { ids: ['frame-2'] }, (documentId) => {
      events.push(`activate:${documentId}`)
    })

    await Promise.resolve()
    expect(events).toEqual(['activate:document-2', 'switch:page-2', 'select', 'zoom'])
    expect(selected).toEqual([['frame-2']])
    expect(frames).toHaveLength(1)

    frames.shift()?.(0)
    expect(frames).toHaveLength(1)
    frames.shift()?.(16)
    await presentation
  })

  test('selects all top-level page nodes when ids are omitted', async () => {
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    const { events, selected, target } = createTarget('page-2')

    await presentExportImageTarget(target, {}, (documentId) => {
      events.push(`activate:${documentId}`)
    })

    expect(events).toEqual(['activate:document-2', 'select', 'zoom'])
    expect(selected).toEqual([['frame-1', 'frame-2']])
  })
})
