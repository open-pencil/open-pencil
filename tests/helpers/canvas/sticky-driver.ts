import { expect, type Page } from '@playwright/test'

import type { Color } from '@open-pencil/scene-graph/primitives'

import { toolbarToolTestId } from '#tests/helpers/test-ids'

/** The canvas point the page's origin is shown at, at 100%. */
const ORIGIN = 100

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

export interface StickyFocus {
  tool: string
  selected: string[]
  /** The text being typed into, if any. */
  editing: string | null
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
  return {
    /** Setup: shows the page's origin at a known canvas point. */
    showOrigin() {
      return page().evaluate((origin) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.state.zoom = 1
        store.state.panX = origin
        store.state.panY = origin
        store.requestRender()
      }, ORIGIN)
    },

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
    notes(): Promise<StickyNoteState[]> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const hex = (value = 0) =>
          Math.round(value * 255)
            .toString(16)
            .padStart(2, '0')
        return store.graph
          .getChildren(store.state.currentPageId)
          .filter((node) => node.type === 'STICKY')
          .map((sticky) => {
            const [body, author] = store.graph.getChildren(sticky.id)
            const color = sticky.fills[0]?.color
            return {
              id: sticky.id,
              name: sticky.name,
              x: sticky.x,
              y: sticky.y,
              width: sticky.width,
              height: sticky.height,
              fill: `#${hex(color?.r)}${hex(color?.g)}${hex(color?.b)}`,
              body: { text: body.text, fontSize: body.fontSize },
              author: { text: author.text, visible: author.visible }
            }
          })
      })
    },

    /** Probe: the active tool, the selection, and the text being typed into. */
    focus(): Promise<StickyFocus> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return {
          tool: store.state.activeTool,
          selected: [...store.state.selectedIds],
          editing: store.state.editingTextId
        }
      })
    },

    /** Canvas coordinates of a page point, under `showOrigin`. */
    point(x: number, y: number) {
      return { x: ORIGIN + x, y: ORIGIN + y }
    },

    /** Driver: shows the sticky tool from Customize toolbar, where it starts hidden. */
    async showTool() {
      const button = page().getByTestId(toolbarToolTestId('STICKY'))
      if ((await button.count()) > 0) return
      await page().getByTestId('toolbar').click({ button: 'right' })
      await page().getByRole('menuitem', { name: 'Customize toolbar…' }).click()
      await page()
        .getByTestId('settings-toolbar-panel')
        .getByRole('switch', { name: 'Show Sticky note', exact: true })
        .click()
      await page().getByTestId('app-settings-done').click()
      await expect(button).toBeVisible()
    },

    /** Driver: picks the sticky tool from the toolbar. */
    async pickTool() {
      await page().getByTestId(toolbarToolTestId('STICKY')).click()
    }
  }
}
