import type { Page } from '@playwright/test'

import type { SceneNode } from '@open-pencil/scene-graph'

type CornerProps = Partial<
  Pick<
    SceneNode,
    | 'cornerRadius'
    | 'independentCorners'
    | 'topLeftRadius'
    | 'topRightRadius'
    | 'bottomRightRadius'
    | 'bottomLeftRadius'
  >
>

/** Shows a selected rectangle at 100% with its top-left 100 px into the canvas, and reads its radii. */
export function cornerRadiusDriver(page: () => Page) {
  return {
    /** A 160 × 232 rectangle, selected. */
    show(props: CornerProps = {}) {
      return page().evaluate((props) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
          name: 'Card',
          x: 0,
          y: 0,
          width: 160,
          height: 232,
          fills: [
            { type: 'SOLID', visible: true, opacity: 1, color: { r: 0.8, g: 0.6, b: 0.6, a: 1 } }
          ],
          ...props
        })
        store.select([node.id])
        store.state.zoom = 1
        store.state.panX = 100
        store.state.panY = 100
        store.requestRender()
        return node.id
      }, props)
    },

    /** Canvas coordinates of a point in the rectangle's own pixels. */
    point(x: number, y: number) {
      return { x: 100 + x, y: 100 + y }
    },

    /** Top-left, top-right, bottom-right, and bottom-left radii as drawn. */
    radii(nodeId: string) {
      return page().evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        if (!node) return null
        const { cornerRadius: radius } = node
        return node.independentCorners
          ? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius]
          : [radius, radius, radius, radius]
      }, nodeId)
    }
  }
}
