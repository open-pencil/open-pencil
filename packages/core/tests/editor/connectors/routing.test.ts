import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  buildConnectorSublayers,
  connectorSublayers,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'

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

/** Where the connector's end sits, if it is free. */
function end(editor: ReturnType<typeof createEditor>, connector: SceneNode) {
  return editor.graph.getNode(connector.id)?.connectorEnd?.position
}

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
      const frame = editor.graph.createNode('FRAME', page, {
        x: 400,
        y: 0,
        width: 200,
        height: 200
      })
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

  test('an end pinned to a point of a section follows it as it moves, not as it resizes', async () => {
    const { editor, page, connector } = setup()
    try {
      const section = editor.graph.createNode('SECTION', page, {
        x: 400,
        y: -200,
        width: 400,
        height: 320
      })
      const pinned = { nodeId: section.id, magnet: 'ABSOLUTE' as const, position: { x: 40, y: 258 } }
      editor.updateNodeWithUndo(connector.id, { connectorEnd: pinned }, 'Bind')
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([433.5, 58])
      editor.updateNodeWithUndo(section.id, { x: 500 }, 'Move')
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([533.5, 58])
      editor.updateNodeWithUndo(section.id, { width: 200, height: 160 }, 'Resize')
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([533.5, 58])
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
      // Undo puts the free end back with the connector, and redo carries it again.
      editor.undoAction()
      await settle()
      expect(editor.graph.getNode(connector.id)?.connectorEnd?.position).toEqual({ x: 400, y: 300 })
      expect(route(editor, connector).at(-1)).toEqual([400, 300])
      editor.redoAction()
      await settle()
      expect(editor.graph.getNode(connector.id)?.connectorEnd?.position).toEqual({ x: 450, y: 320 })
    } finally {
      editor.dispose()
    }
  })

  test('a move recorded as no step joins no other step with its carried ends', async () => {
    const { editor, from, connector } = setup()
    try {
      editor.updateNodeWithUndo(connector.id, { connectorEnd: freeEndpoint(400, 300) }, 'Free')
      await settle()
      editor.updateNodeWithUndo(from.id, { name: 'Renamed' }, 'Rename')
      const moved = expectDefined(editor.graph.getNode(connector.id))
      editor.graph.updateNode(connector.id, { x: moved.x + 50, y: moved.y + 20 })
      await settle()
      expect(editor.graph.getNode(connector.id)?.connectorEnd?.position).toEqual({ x: 450, y: 320 })
      // Undoing the rename leaves the carried end where the unrecorded move put it.
      editor.undoAction()
      await settle()
      expect(editor.graph.getNode(from.id)?.name).not.toBe('Renamed')
      expect(editor.graph.getNode(connector.id)?.connectorEnd?.position).toEqual({ x: 450, y: 320 })
    } finally {
      editor.dispose()
    }
  })

  test('nudging a connector carries its free end, and undo puts it back', async () => {
    const { editor, connector } = setup()
    try {
      editor.updateNodeWithUndo(connector.id, { connectorEnd: freeEndpoint(400, 300) }, 'Free')
      await settle()
      editor.select([connector.id])
      editor.nudgeSelected(1, 0)
      await settle()
      editor.nudgeSelected(1, 0)
      await settle()
      editor.flushNudge()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 402, y: 300 })
      editor.undoAction()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 400, y: 300 })
      expect(route(editor, connector).at(-1)).toEqual([400, 300])
      editor.redoAction()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 402, y: 300 })
    } finally {
      editor.dispose()
    }
  })

  test('a drag carries a free end once, however often it previews', async () => {
    const { editor, page, connector } = setup()
    try {
      editor.updateNodeWithUndo(connector.id, { connectorEnd: freeEndpoint(400, 300) }, 'Free')
      await settle()
      const { x, y } = expectDefined(editor.graph.getNode(connector.id))
      // As a drag does: each preview places the connector from where it started.
      for (const dx of [5, 10, 15]) {
        editor.graph.updateNodePositionPreview(connector.id, x + dx, y)
        await settle()
      }
      expect(end(editor, connector)).toEqual({ x: 415, y: 300 })
      expect(route(editor, connector).at(0)).toEqual([106, 50])
      expect(route(editor, connector).at(-1)).toEqual([415, 300])
      editor.undo.runBatch('Move', () => {
        editor.graph.updateNodePositionPreview(connector.id, x, y)
        editor.updateNode(connector.id, { x: x + 15, y })
        editor.commitMoveWithReparent(new Map([[connector.id, { x, y, parentId: page }]]))
      })
      await settle()
      expect(end(editor, connector)).toEqual({ x: 415, y: 300 })
      expect(route(editor, connector).at(0)).toEqual([106, 50])
      editor.undoAction()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 400, y: 300 })
      expect(route(editor, connector).at(-1)).toEqual([400, 300])
      editor.redoAction()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 415, y: 300 })
    } finally {
      editor.dispose()
    }
  })

  test('a previewed move carries free ends, and cancelling or undoing it puts them back', async () => {
    const { editor, connector } = setup()
    try {
      editor.updateNodeWithUndo(connector.id, { connectorEnd: freeEndpoint(400, 300) }, 'Free')
      await settle()
      const { x } = expectDefined(editor.graph.getNode(connector.id))
      const cancelled = editor.beginNodePreview('Move')
      cancelled.update(connector.id, { x: x + 10 })
      await settle()
      expect(end(editor, connector)).toEqual({ x: 410, y: 300 })
      cancelled.cancel()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 400, y: 300 })
      const committed = editor.beginNodePreview('Move')
      committed.update(connector.id, { x: x + 10 })
      await settle()
      committed.commit()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 410, y: 300 })
      editor.undoAction()
      await settle()
      expect(end(editor, connector)).toEqual({ x: 400, y: 300 })
      expect(route(editor, connector).at(-1)).toEqual([400, 300])
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

  test('a layer moved into another parent by reordering routes its connectors again', async () => {
    const { editor, page, to, connector } = setup()
    try {
      const frame = editor.graph.createNode('FRAME', page, {
        x: 0,
        y: 300,
        width: 600,
        height: 300
      })
      await settle()
      // Kept at the same place in its new parent, the layer now sits 300 lower on the page.
      editor.graph.insertChildAt(to.id, frame.id, 0)
      await settle()
      expect(route(editor, connector).at(-1)).toEqual([393.5, 350])
    } finally {
      editor.dispose()
    }
  })

  test('a locked layer that a delete leaves keeps its connectors', () => {
    const { editor, from, to, connector } = setup()
    try {
      editor.graph.updateNode(from.id, { locked: true })
      editor.select([from.id, to.id])
      editor.deleteSelected()
      expect(editor.graph.getNode(from.id)).toBeDefined()
      expect(editor.graph.getNode(to.id)).toBeUndefined()
      // The connector goes with the layer that was deleted, not the one that stays.
      expect(editor.graph.getNode(connector.id)).toBeUndefined()
      editor.undoAction()
      editor.select([from.id])
      editor.deleteSelected()
      expect(editor.graph.getNode(from.id)).toBeDefined()
      expect(editor.graph.getNode(connector.id)).toBeDefined()
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
