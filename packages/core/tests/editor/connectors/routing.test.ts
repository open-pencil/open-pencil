import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import {
  boundEndpoint,
  buildConnectorSublayers,
  connectorSublayers,
  freeEndpoint,
  SceneGraph
} from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'

/** Two boxes 300 apart with an elbow from the first's right side to the second's left. */
function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const from = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 100, height: 100 })
  const to = editor.graph.createNode('RECTANGLE', page, { x: 400, y: 0, width: 100, height: 100 })
  const connector = editor.graph.createNode('CONNECTOR', page, {
    connectorStart: boundEndpoint(from.id),
    connectorEnd: boundEndpoint(to.id)
  })
  buildConnectorSublayers(editor.graph, connector)
  return { editor, page, from, to, connector }
}

/** The line's points in page coordinates. */
function route(editor: ReturnType<typeof createEditor>, connector: SceneNode): number[][] {
  const node = expectDefined(editor.graph.getNode(connector.id))
  const { line } = expectDefined(connectorSublayers(editor.graph, node))
  return (line.vectorNetwork?.vertices ?? []).map((vertex) => [
    node.x + line.x + vertex.x,
    node.y + line.y + vertex.y
  ])
}

const settle = () => Promise.resolve()

// A one-line label "Label" measures 41×24 in Inter Medium 16, as in FigJam.
beforeEach(() => setTextMeasurer(() => ({ width: 41, height: 24 })))
afterEach(() => setTextMeasurer(null))

describe('connector routing', () => {
  test('an edit to a bound layer routes the connector again, and undo routes it back', async () => {
    const { editor, from, to, connector } = setup()
    try {
      editor.updateNodeWithUndo(to.id, { y: 200 }, 'Move')
      await settle()
      expect(route(editor, connector)).toEqual([
        [106, 50],
        [250, 50],
        [250, 250],
        [393.5, 250]
      ])
      editor.undoAction()
      await settle()
      expect(route(editor, connector)).toEqual([
        [106, 50],
        [393.5, 50]
      ])
      editor.updateNodeWithUndo(from.id, { x: 200, y: -300 }, 'Move')
      await settle()
      expect(route(editor, connector)).toEqual([
        [250, -194],
        [250, -100],
        [450, -100],
        [450, -6.5]
      ])
    } finally {
      editor.dispose()
    }
  })

  test('a drag previews the route and a cancelled drag gives it back', async () => {
    const { editor, to, connector } = setup()
    try {
      editor.updateNodeWithUndo(to.id, { x: 400 }, 'Settle')
      await settle()
      const before = route(editor, connector)
      const preview = editor.beginNodePreview('Move')
      preview.update(to.id, { y: 200 })
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([393.5, 250])
      preview.cancel()
      await settle()
      expect(route(editor, connector)).toEqual(before)
    } finally {
      editor.dispose()
    }
  })

  test('a route follows a layer inside a moved frame', async () => {
    const { editor, page, connector } = setup()
    try {
      const frame = editor.graph.createNode('FRAME', page, { x: 400, y: 0, width: 200, height: 200 })
      const inner = editor.graph.createNode('RECTANGLE', frame.id, {
        x: 0,
        y: 0,
        width: 100,
        height: 100
      })
      editor.updateNodeWithUndo(connector.id, { connectorEnd: boundEndpoint(inner.id) }, 'Bind')
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([393.5, 50])
      editor.updateNodeWithUndo(frame.id, { x: 600 }, 'Move')
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([593.5, 50])
    } finally {
      editor.dispose()
    }
  })

  test('a free end stays where it is put', async () => {
    const { editor, connector } = setup()
    try {
      editor.updateNodeWithUndo(connector.id, { connectorEnd: freeEndpoint(400, 300) }, 'Free')
      await settle()
      // It leaves by the side nearest the point and bends midway, arriving along the longer axis.
      expect(route(editor, connector)).toEqual([
        [106, 50],
        [250, 50],
        [250, 300],
        [400, 300]
      ])
    } finally {
      editor.dispose()
    }
  })

  test('a connector moved as a whole takes its free ends along', async () => {
    const { editor, connector } = setup()
    try {
      editor.updateNodeWithUndo(connector.id, { connectorEnd: freeEndpoint(400, 300) }, 'Free')
      await settle()
      const moved = expectDefined(editor.graph.getNode(connector.id))
      editor.updateNodeWithUndo(connector.id, { x: moved.x + 50, y: moved.y + 20 }, 'Move')
      await settle()
      // The free end moves with the connector; the bound start goes back to its layer.
      expect(editor.graph.getNode(connector.id)?.connectorEnd?.position).toEqual({ x: 450, y: 320 })
      expect(route(editor, connector).at(0)).toEqual([106, 50])
      expect(route(editor, connector).at(-1)).toEqual([450, 320])
    } finally {
      editor.dispose()
    }
  })

  test('a label sits on its plate midway and the line breaks around it', async () => {
    const { editor, connector } = setup()
    try {
      const { label } = expectDefined(connectorSublayers(editor.graph, connector))
      editor.updateNodeWithUndo(label.id, { text: 'Label' }, 'Label')
      await settle()
      const parts = expectDefined(connectorSublayers(editor.graph, connector))
      const node = expectDefined(editor.graph.getNode(connector.id))
      expect([
        node.x + parts.labelBackground.x,
        node.y + parts.labelBackground.y,
        parts.labelBackground.width,
        parts.labelBackground.height,
        parts.labelBackground.visible
      ]).toEqual([220.75, 29.5, 58, 41, true])
      expect([node.x + parts.label.x, node.y + parts.label.y]).toEqual([229.25, 38])
      expect(route(editor, connector)).toEqual([
        [106, 50],
        [220.75, 50],
        [278.75, 50],
        [393.5, 50]
      ])
      expect(parts.line.vectorNetwork?.segments.map(({ start, end }) => [start, end])).toEqual([
        [0, 1],
        [2, 3]
      ])
    } finally {
      editor.dispose()
    }
  })

  test('deleting a layer deletes the connectors attached to it in the same undo step', () => {
    const { editor, page, from, connector } = setup()
    try {
      const other = editor.graph.createNode('CONNECTOR', page, {
        connectorStart: freeEndpoint(0, 0),
        connectorEnd: freeEndpoint(100, 100)
      })
      editor.select([from.id])
      editor.deleteSelected()
      expect(editor.graph.getNode(connector.id)).toBeUndefined()
      expect(editor.graph.getNode(other.id)).toBeDefined()
      editor.undoAction()
      expect(editor.graph.getNode(from.id)).toBeDefined()
      expect(editor.graph.getNode(connector.id)?.connectorStart?.nodeId).toBe(from.id)
    } finally {
      editor.dispose()
    }
  })

  test('a connector a file saved without a route is routed when shown, without an edit', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0].id
    const from = graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 100, height: 100 })
    const to = graph.createNode('RECTANGLE', page, { x: 400, y: 0, width: 100, height: 100 })
    const connector = graph.createNode('CONNECTOR', page, {
      connectorStart: boundEndpoint(from.id),
      connectorEnd: boundEndpoint(to.id)
    })
    // As read from a record with no derived data: the label has its text but not its size.
    buildConnectorSublayers(graph, connector, {
      label: { text: 'Label', width: 100, height: 100, textAutoResize: 'WIDTH_AND_HEIGHT' }
    })
    const editor = createEditor()
    try {
      editor.replaceGraph(graph)
      expect(route(editor, connector)).toEqual([
        [106, 50],
        [220.75, 50],
        [278.75, 50],
        [393.5, 50]
      ])
      const { label } = expectDefined(connectorSublayers(editor.graph, connector))
      expect([label.width, label.height]).toEqual([41, 24])
      expect(editor.undo.canUndo).toBe(false)
    } finally {
      editor.dispose()
    }
  })

  test('layout routes a connector with no route and keeps one that has a route', () => {
    const { editor, page, to, connector } = setup()
    try {
      computeAllLayouts(editor.graph, page)
      const routed = route(editor, connector)
      expect(routed.length).toBeGreaterThan(0)
      editor.graph.updateNode(to.id, { y: 200 })
      computeAllLayouts(editor.graph, page)
      expect(route(editor, connector)).toEqual(routed)
    } finally {
      editor.dispose()
    }
  })
})
