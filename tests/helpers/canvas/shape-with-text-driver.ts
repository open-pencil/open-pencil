import type { Page } from '@playwright/test'

import type { ShapeWithTextType } from '@open-pencil/scene-graph/shape-with-text'

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
            strokes: [{ ...solid(shape.stroke), weight: 2, align: 'CENTER' as const }]
          })
          const [label] = store.graph.getChildren(id)
          store.graph.updateNode(label.id, { text: shape.label, fills: [solid(shape.labelColor)] })
          store.runLayoutForNode(id)
        }
        store.clearSelection()
        store.requestRender()
      }, shapes)
    }
  }
}
