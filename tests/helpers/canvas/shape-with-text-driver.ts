import type { Page } from '@playwright/test'

import type { Color } from '@open-pencil/scene-graph/primitives'
import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

import { toolbarToolTestId } from '#tests/helpers/test-ids'

import { hexColor, toolDriver } from './tool-driver'

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
  const tools = toolDriver(page, 'SHAPE_WITH_TEXT', 'Show Shape')
  return {
    ...tools,

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

    /** Probe: the page's shapes with text, the last placed last. */
    async shapes(): Promise<ShapeWithTextState[]> {
      // A paint the shape lacks reads as no colour.
      const hex = (color: Color | undefined) => (color ? hexColor(color) : '')
      return (await tools.layers()).map(({ node, children: [label] }) => ({
        id: node.id,
        name: node.name,
        kind: node.shapeWithTextType,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        fill: hex(node.fills.at(0)?.color),
        stroke: hex(node.strokes.at(0)?.color),
        strokeWeight: node.strokes.at(0)?.weight ?? 0,
        truncates: node.shapeTruncates,
        label: label
          ? { text: label.text, fontSize: label.fontSize, truncation: label.textTruncation }
          : null
      }))
    },

    /** Driver: opens the shape tool's kinds and picks one by its name. */
    async pickKind(name: string) {
      await page().getByTestId(toolbarToolTestId('SHAPE_WITH_TEXT')).click()
      await page().getByRole('option', { name, exact: true }).click()
    }
  }
}
