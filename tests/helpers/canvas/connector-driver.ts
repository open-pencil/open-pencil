import { expect, type Page } from '@playwright/test'

import type { ConnectorEndpoint } from '@open-pencil/scene-graph'

import { toolbarToolTestId } from '#tests/helpers/test-ids'

/** The canvas point the page's origin is shown at, at 100%. */
const ORIGIN = 100

export interface ConnectorState {
  id: string
  start: ConnectorEndpoint | null
  end: ConnectorEndpoint | null
  label: string
}

/** Connectors between layers on a page shown at 100% with its origin 100 px into the canvas. */
export function connectorDriver(page: () => Page) {
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

    /** Setup: named rectangles at page boxes; returns their ids by name. */
    addBoxes(boxes: { name: string; x: number; y: number; width: number; height: number }[]) {
      return page().evaluate((specs) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const ids: Record<string, string> = {}
        for (const spec of specs) {
          const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
            ...spec,
            fills: [
              {
                type: 'SOLID',
                color: { r: 0.85, g: 0.88, b: 0.95, a: 1 },
                opacity: 1,
                visible: true
              }
            ]
          })
          ids[spec.name] = node.id
        }
        store.clearSelection()
        store.requestRender()
        return ids
      }, boxes)
    },

    /** Probe: the page's connectors, the last drawn last. */
    connectors(): Promise<ConnectorState[]> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return store.graph
          .getChildren(store.state.currentPageId)
          .filter((node) => node.type === 'CONNECTOR')
          .map((connector) => ({
            id: connector.id,
            start: connector.connectorStart,
            end: connector.connectorEnd,
            label: store.graph.getChildren(connector.id)[2]?.text ?? ''
          }))
      })
    },

    /** Probe: the active tool, the selection, the text being typed into, and the attach target. */
    focus() {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return {
          tool: store.state.activeTool,
          selected: [...store.state.selectedIds],
          editing: store.state.editingTextId,
          target: store.state.connectorTarget
        }
      })
    },

    /** Canvas coordinates of a page point, under `showOrigin`. */
    point(x: number, y: number) {
      return { x: ORIGIN + x, y: ORIGIN + y }
    },

    /** Driver: shows the connector tool from Customize toolbar, where it starts hidden. */
    async showTool() {
      const button = page().getByTestId(toolbarToolTestId('CONNECTOR'))
      if ((await button.count()) > 0) return
      await page().getByTestId('toolbar').click({ button: 'right' })
      await page().getByRole('menuitem', { name: 'Customize toolbar…' }).click()
      await page()
        .getByTestId('settings-toolbar-panel')
        .getByRole('switch', { name: 'Show Connector', exact: true })
        .click()
      await page().getByTestId('app-settings-done').click()
      await expect(button).toBeVisible()
    },

    /** Driver: picks the connector tool from the toolbar. */
    async pickTool() {
      await page().getByTestId(toolbarToolTestId('CONNECTOR')).click()
    }
  }
}
