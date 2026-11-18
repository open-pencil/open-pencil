import { expect, type Page } from '@playwright/test'

import type { EditorState } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { showView } from '#tests/helpers/canvas/page-scene'
import { toolbarToolTestId } from '#tests/helpers/test-ids'

/** The canvas point the page's origin is shown at, at 100%. */
export const ORIGIN = 100

/** A board tool the toolbar keeps hidden until Customize toolbar shows it. */
export type HiddenTool = 'STICKY' | 'CONNECTOR' | 'SHAPE_WITH_TEXT'

export interface ToolFocus {
  tool: string
  selected: string[]
  /** The text being typed into, if any. */
  editing: string | null
  /** The layer and magnet a connector end would attach to, if any. */
  target: EditorState['connectorTarget']
}

/** A layer a board tool made, with its children: a note's text, a shape's label, a connector's parts. */
export interface ToolLayer {
  node: SceneNode
  children: SceneNode[]
}

/** A colour as the `#rrggbb` the specs compare. */
export function hexColor(color: Color | undefined): string {
  return colorToHex(color ?? { r: 0, g: 0, b: 0, a: 1 }).toLowerCase()
}

/**
 * What every driver of a hidden board tool shares, on a page shown at 100% with its origin
 * `ORIGIN` px into the canvas: the view, page points, focus, and showing and picking the tool.
 */
export function toolDriver(page: () => Page, tool: HiddenTool, switchName: string) {
  const button = () => page().getByTestId(toolbarToolTestId(tool))
  return {
    /** Setup: shows the page's origin at a known canvas point. */
    showOrigin() {
      return showView(page(), { zoom: 1, panX: ORIGIN, panY: ORIGIN })
    },

    /** Canvas coordinates of a page point, under `showOrigin`. */
    point(x: number, y: number) {
      return { x: ORIGIN + x, y: ORIGIN + y }
    },

    /** Probe: the page's layers the tool makes, the last placed last, each with its children. */
    layers(): Promise<ToolLayer[]> {
      return page().evaluate((type) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        return store.graph
          .getChildren(store.state.currentPageId)
          .filter((node) => node.type === type)
          .map((node) => ({ node, children: store.graph.getChildren(node.id) }))
      }, tool)
    },

    /** Probe: the active tool, the selection, the text being typed into, and the attach target. */
    focus(): Promise<ToolFocus> {
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

    /** Driver: shows the tool from Customize toolbar, where it starts hidden. */
    async showTool() {
      if ((await button().count()) > 0) return
      await page().getByTestId('toolbar').click({ button: 'right' })
      await page().getByRole('menuitem', { name: 'Customize toolbar…' }).click()
      await page()
        .getByTestId('settings-toolbar-panel')
        .getByRole('switch', { name: switchName, exact: true })
        .click()
      await page().getByTestId('app-settings-done').click()
      await expect(button()).toBeVisible()
    },

    /** Driver: picks the tool from the toolbar. */
    async pickTool() {
      await button().click()
    }
  }
}
