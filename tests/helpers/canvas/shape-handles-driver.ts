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
    | 'cornerSmoothing'
    | 'pointCount'
    | 'starInnerRadius'
    | 'arcData'
  >
>

type CornerShape = 'RECTANGLE' | 'POLYGON' | 'STAR' | 'ELLIPSE'

/** Shows a selected shape at 100% with its top-left 100 px into the canvas, and reads its radii. */
export function shapeHandlesDriver(page: () => Page) {
  return {
    /** A 160 × 232 rectangle, or a 160 × 160 polygon, star, or ellipse, selected. */
    show(props: CornerProps = {}, type: CornerShape = 'RECTANGLE') {
      return page().evaluate(
        ({ props, type }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          const node = store.graph.createNode(type, store.state.currentPageId, {
            name: 'Card',
            x: 0,
            y: 0,
            width: 160,
            height: type === 'RECTANGLE' ? 232 : 160,
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
        },
        { props, type }
      )
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
    },

    /** A polygon's or star's point count and a star's inner ratio. */
    points(nodeId: string) {
      return page().evaluate((id) => {
        const node = window.openPencil?.getStore?.().graph.getNode(id)
        return node ? { count: node.pointCount, ratio: node.starInnerRadius } : null
      }, nodeId)
    },

    /** An ellipse's start and end in whole degrees and its inner ratio, or null for a whole one. */
    arc(nodeId: string) {
      return page().evaluate((id) => {
        const arc = window.openPencil?.getStore?.().graph.getNode(id)?.arcData
        if (!arc) return null
        const degrees = (angle: number) => Math.round((angle * 180) / Math.PI)
        return {
          start: degrees(arc.startingAngle),
          end: degrees(arc.endingAngle),
          ratio: Math.round(arc.innerRadius * 1000) / 1000
        }
      }, nodeId)
    }
  }
}
