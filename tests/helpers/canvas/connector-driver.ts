import type { Page } from '@playwright/test'

import type { ConnectorEndpoint } from '@open-pencil/scene-graph'
import type { Size, Vector } from '@open-pencil/scene-graph/primitives'

import { showView } from '#tests/helpers/canvas/page-scene'

import { hexColor, toolDriver } from './tool-driver'

/** The fill of the boxes connectors attach to. */
const BOX_FILL = {
  type: 'SOLID' as const,
  color: { r: 0.85, g: 0.88, b: 0.95, a: 1 },
  opacity: 1,
  visible: true
}

export interface ConnectorState {
  id: string
  start: ConnectorEndpoint | null
  end: ConnectorEndpoint | null
  label: string
}

/** Connectors between layers on a page shown at 100% with its origin 100 px into the canvas. */
export function connectorDriver(page: () => Page) {
  /**
   * Draws one connector per row with the connector tool, from the centre of a `size` box at
   * `from` to the centre of one at `to`; returns the connectors' ids, row by row.
   */
  function connectBoxes(rows: readonly { from: Vector; to: Vector }[], size: Size) {
    return page().evaluate(
      ({ pairs, boxSize, fill }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const pageId = store.state.currentPageId
        const box = (at: Vector) =>
          store.graph.createNode('RECTANGLE', pageId, { ...at, ...boxSize, fills: [fill] })
        const ids = pairs.map(({ from, to }) => {
          const start = box(from)
          const end = box(to)
          store.setTool('CONNECTOR')
          store.connectorBegin(start.x + boxSize.width / 2, start.y + boxSize.height / 2)
          store.connectorRelease(end.x + boxSize.width / 2, end.y + boxSize.height / 2, true)
          const connector = store.graph
            .getChildren(pageId)
            .findLast((node) => node.type === 'CONNECTOR')
          if (!connector) throw new Error('No connector')
          return connector.id
        })
        store.setTool('SELECT')
        return ids
      },
      { pairs: rows, boxSize: size, fill: BOX_FILL }
    )
  }

  /** Setup: named rectangles at page boxes; returns their ids by name. */
  function addBoxes(
    boxes: { name: string; x: number; y: number; width: number; height: number }[]
  ) {
    return page().evaluate(
      ({ specs, fill }) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const ids: Record<string, string> = {}
        for (const spec of specs) {
          const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
            ...spec,
            fills: [fill]
          })
          ids[spec.name] = node.id
        }
        store.clearSelection()
        store.requestRender()
        return ids
      },
      { specs: boxes, fill: BOX_FILL }
    )
  }

  const tools = toolDriver(page, 'CONNECTOR', 'Show Connector')
  return {
    ...tools,

    addBoxes,
    /** Probe: the page's connectors, the last drawn last. */
    async connectors(): Promise<ConnectorState[]> {
      return (await tools.layers()).map(({ node: connector, children }) => ({
        id: connector.id,
        start: connector.connectorStart,
        end: connector.connectorEnd,
        label: children[2]?.text ?? ''
      }))
    },

    /** A point on a connector's line, midway along its first piece, in page coordinates. */
    linePoint(id: string) {
      return page().evaluate((connectorId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const connector = store.graph.getNode(connectorId)
        const line = connector && store.graph.getChildren(connector.id)[0]
        const [a, b] = line?.vectorNetwork?.vertices ?? []
        if (!connector || !line || !a || !b) throw new Error(`No route for ${connectorId}`)
        return {
          x: connector.x + line.x + (a.x + b.x) / 2,
          y: connector.y + line.y + (a.y + b.y) / 2
        }
      }, id)
    },

    /**
     * Setup: four connectors at 100%, one per filled cap, the first selected, and a layer
     * outlined as an attach target, for the canvas to draw them all.
     */
    async showCapsAndHandles() {
      const caps = [
        'TRIANGLE_FILLED',
        'DIAMOND_FILLED',
        'CIRCLE_FILLED',
        'ARROW_EQUILATERAL'
      ] as const
      const connectors = await connectBoxes(
        caps.map((_, row) => ({
          from: { x: 40, y: 40 + row * 160 },
          to: { x: 480, y: 100 + row * 160 }
        })),
        { width: 160, height: 120 }
      )
      const { Target: target } = await addBoxes([
        { name: 'Target', x: 760, y: 300, width: 160, height: 120 }
      ])
      await page().evaluate(
        ({ ids, capList, targetId }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          ids.forEach((id, row) => {
            store.setConnectorCap([id], 'start', capList[row])
            store.setConnectorCap([id], 'end', capList[row])
          })
          store.select([ids[0]])
          store.state.connectorTarget = { nodeId: targetId, magnet: 'TOP' }
        },
        { ids: connectors, capList: caps, targetId: target }
      )
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
    },

    /**
     * Setup: three elbowed connectors at 100%, styled as FigJam's line menu styles them: thin and
     * dashed, thick and dashed, and thick and solid, each in a palette colour.
     */
    async showLineStyles() {
      const styles = [
        { color: 'violet', thick: false, dashed: true },
        { color: 'red', thick: true, dashed: true },
        { color: 'blue', thick: true, dashed: false }
      ] as const
      const connectors = await connectBoxes(
        styles.map((_, row) => ({
          from: { x: 40, y: 40 + row * 180 },
          to: { x: 480, y: 120 + row * 180 }
        })),
        { width: 120, height: 80 }
      )
      await page().evaluate(
        ({ ids, styleList }) => {
          const store = window.openPencil?.getStore?.()
          if (!store) throw new Error('OpenPencil store not initialized')
          ids.forEach((id, row) => {
            const style = styleList[row]
            store.setConnectorColor([id], style.color)
            store.setConnectorThick([id], style.thick)
            store.setConnectorDashed([id], style.dashed)
          })
          store.clearSelection()
        },
        { ids: connectors, styleList: styles }
      )
      await showView(page(), { zoom: 1, panX: 0, panY: 0 })
    },

    /**
     * Setup: a section with connectors drawn into it from boxes left of it, below it, and right
     * of it, dropped away from its outline and centre so each end is pinned where it was dropped.
     */
    showPinnedEnds() {
      return page().evaluate((fill) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const page = store.state.currentPageId
        const fills = [fill]
        store.graph.createNode('SECTION', page, { x: 400, y: 40, width: 360, height: 320, fills })
        const sources = [
          { box: { x: 20, y: 140, width: 160, height: 160 }, drop: { x: 440, y: 298 } },
          { box: { x: 552, y: 504, width: 96, height: 96 }, drop: { x: 480, y: 298 } },
          { box: { x: 790, y: 152, width: 96, height: 96 }, drop: { x: 480, y: 120 } }
        ]
        store.setTool('CONNECTOR')
        for (const { box, drop } of sources) {
          store.graph.createNode('RECTANGLE', page, { ...box, fills })
          store.connectorBegin(box.x + box.width / 2, box.y + box.height / 2)
          store.connectorRelease(drop.x, drop.y, true)
        }
        store.setTool('SELECT')
        store.clearSelection()
        store.state.zoom = 1
        store.state.panX = 0
        store.state.panY = 0
        store.requestRender()
      }, BOX_FILL)
    },

    /** Driver: selects one connector, as clicking its line would. */
    select(id: string) {
      return page().evaluate((connectorId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        store.select([connectorId])
      }, id)
    },

    /** A connector's line type and end caps, as the Connector section sets them. */
    style(id: string) {
      return page().evaluate((connectorId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const node = store.graph.getNode(connectorId)
        if (!node) throw new Error(`No connector ${connectorId}`)
        return {
          line: node.connectorLineType,
          startCap: node.connectorStartCap,
          endCap: node.connectorEndCap
        }
      }, id)
    },

    /** Probe: how a connector's line is stroked: its colour as `#rrggbb`, weight and dash. */
    async lineStroke(id: string) {
      const stroke = await page().evaluate((connectorId) => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const [line] = store.graph.getChildren(connectorId)
        const stroke = line?.strokes[0]
        if (!stroke) throw new Error(`No line stroke on ${connectorId}`)
        return { color: stroke.color, weight: stroke.weight, dash: stroke.dashPattern ?? [] }
      }, id)
      return { ...stroke, color: hexColor(stroke.color) }
    }
  }
}
