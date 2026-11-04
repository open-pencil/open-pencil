import { expect, type Page } from '@playwright/test'

import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import { toolbarToolTestId } from '#tests/helpers/test-ids'

/** The canvas point the page's origin is shown at, at 100%. */
const ORIGIN = 100

type RGB = readonly [number, number, number]

export interface ShapeWithTextSetup {
  kind: ShapeWithTextType
  label: string
  x: number
  y: number
  width: number
  height: number
  fill: RGB
  stroke: RGB
  /** The label's own colour, kept on the label layer as FigJam keeps it. */
  labelColor: RGB
  /** Where the stroke sits on the outline; centred unless set. */
  strokeAlign?: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  strokeWeight?: number
}

export interface ShapeWithTextState {
  id: string
  name: string
  kind: ShapeWithTextType
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWeight: number
  /** Whether it keeps its height and truncates its label, as once its height was set. */
  truncates: boolean
  label: { text: string; fontSize: number; truncation: string } | null
}

/** Places shapes with text as the editor draws them, each with its label laid out inside. */
export function shapeWithTextDriver(page: () => Page) {
  return {
    place(shapes: readonly ShapeWithTextSetup[]) {
      return page().evaluate((setups) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const solid = ([r, g, b]: readonly [number, number, number]) => ({
          type: 'SOLID' as const,
          color: { r, g, b, a: 1 },
          visible: true,
          opacity: 1
        })
        for (const shape of setups) {
          const id = store.createShape(
            'SHAPE_WITH_TEXT',
            shape.x,
            shape.y,
            shape.width,
            shape.height
          )
          store.graph.updateNode(id, {
            name: shape.label,
            shapeWithTextType: shape.kind,
            fills: [solid(shape.fill)],
            strokes: [
              {
                ...solid(shape.stroke),
                weight: shape.strokeWeight ?? 2,
                align: shape.strokeAlign ?? 'CENTER'
              }
            ]
          })
          const [label] = store.graph.getChildren(id)
          store.graph.updateNode(label.id, { text: shape.label, fills: [solid(shape.labelColor)] })
          store.runLayoutForNode(id)
        }
        store.clearSelection()
        store.requestRender()
      }, shapes)
    },

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

    /** Canvas coordinates of a page point, under `showOrigin`. */
    point(x: number, y: number) {
      return { x: ORIGIN + x, y: ORIGIN + y }
    },

    /** Probe: the page's shapes with text, the last placed last. */
    shapes(): Promise<ShapeWithTextState[]> {
      return page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const hex = (paint?: { color: { r: number; g: number; b: number } }) =>
          paint
            ? '#' +
              [paint.color.r, paint.color.g, paint.color.b]
                .map((value) =>
                  Math.round(value * 255)
                    .toString(16)
                    .padStart(2, '0')
                )
                .join('')
            : ''
        return store.graph
          .getChildren(store.state.currentPageId)
          .filter((node) => node.type === 'SHAPE_WITH_TEXT')
          .map((node) => {
            const [label] = store.graph.getChildren(node.id)
            return {
              id: node.id,
              name: node.name,
              kind: node.shapeWithTextType,
              x: node.x,
              y: node.y,
              width: node.width,
              height: node.height,
              fill: hex(node.fills.at(0)),
              stroke: hex(node.strokes.at(0)),
              strokeWeight: node.strokes.at(0)?.weight ?? 0,
              truncates: node.shapeTruncates,
              label: label
                ? { text: label.text, fontSize: label.fontSize, truncation: label.textTruncation }
                : null
            }
          })
      })
    },

    /** Probe: the active tool, the selection, and the text being typed into. */
    focus() {
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

    /** Setup: shows the shape tool, which the toolbar keeps hidden, from Customize toolbar. */
    async showTool() {
      const button = page().getByTestId(toolbarToolTestId('SHAPE_WITH_TEXT'))
      if ((await button.count()) > 0) return
      await page().getByTestId('toolbar').click({ button: 'right' })
      await page().getByRole('menuitem', { name: 'Customize toolbar…' }).click()
      await page()
        .getByTestId('settings-toolbar-panel')
        .getByRole('switch', { name: 'Show Shape', exact: true })
        .click()
      await page().getByTestId('app-settings-done').click()
      await expect(button).toBeVisible()
    },

    /** Driver: opens the shape tool's kinds and picks one by its name. */
    async pickKind(name: string) {
      await page().getByTestId(toolbarToolTestId('SHAPE_WITH_TEXT')).click()
      await page().getByRole('option', { name, exact: true }).click()
    }
  }
}
