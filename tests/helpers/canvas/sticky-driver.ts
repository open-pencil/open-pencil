import type { Page } from '@playwright/test'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { hexColor, toolDriver } from './tool-driver'

export interface StickyNoteState {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  /** The note's colour as `#rrggbb`. */
  fill: string
  body: { text: string; fontSize: number }
  author: { text: string; visible: boolean }
}

export interface StickyNoteSetup {
  x: number
  y: number
  text?: string
  author?: string
  color?: Color
  authorVisible?: boolean
}

/** Sticky notes on a page shown at 100% with its origin 100 px into the canvas. */
export function stickyDriver(page: () => Page) {
  const tools = toolDriver(page, 'STICKY', 'Show Sticky note')
  return {
    ...tools,

    /** Setup: notes centred on page points, for specs whose subject is how notes look. */
    add(notes: StickyNoteSetup[]) {
      return page().evaluate((specs) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        for (const spec of specs) {
          const note = store.createStickyNote(store.state.currentPageId, spec)
          const [body, author] = store.graph.getChildren(note.id)
          store.graph.updateNode(body.id, { text: spec.text ?? '' })
          store.graph.updateNode(author.id, { text: spec.author ?? '' })
          if (spec.color) store.setStickyColor([note.id], spec.color)
          if (spec.authorVisible === false) store.setStickyAuthorVisible([note.id], false)
          store.runLayoutForNode(note.id)
        }
        store.clearSelection()
      }, notes)
    },

    /** Probe: the page's notes, the last placed last. */
    async notes(): Promise<StickyNoteState[]> {
      return (await tools.layers()).map(({ node: sticky, children: [body, author] }) => ({
        id: sticky.id,
        name: sticky.name,
        x: sticky.x,
        y: sticky.y,
        width: sticky.width,
        height: sticky.height,
        fill: hexColor(sticky.fills[0]?.color),
        body: { text: body.text, fontSize: body.fontSize },
        author: { text: author.text, visible: author.visible }
      }))
    }
  }
}
