import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { boundEndpoint, createConnector, freeEndpoint } from '@open-pencil/scene-graph'
import { connectorAttachment, magnetAt } from '#core/editor/connectors/attach'

function setup() {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const a = editor.graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 200, height: 200 })
  const b = editor.graph.createNode('RECTANGLE', page, { x: 500, y: 100, width: 200, height: 200 })
  return { editor, page, a, b }
}

function connectors(editor: ReturnType<typeof createEditor>) {
  return [...editor.graph.getAllNodes()].filter((node) => node.type === 'CONNECTOR')
}

const BOX = { x: 0, y: 0, width: 200, height: 200 }

// Measured with FigJam's connector tool on a 200 px square at 100% on 2026-10-15.
describe('where a connector end attaches', () => {
  test('the centre attaches by any side, and points inside take the nearest side', () => {
    expect(magnetAt(BOX, { x: 100, y: 100 }, 1)).toBe('AUTO')
    expect(magnetAt(BOX, { x: 16, y: 30 }, 1)).toBe('LEFT')
    expect(magnetAt(BOX, { x: 30, y: 16 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 100, y: 50 }, 1)).toBe('TOP')
  })

  test('near the outline an end holds to it, by a side when at its midpoint', () => {
    expect(magnetAt(BOX, { x: 4, y: 50 }, 1)).toBe('AUTO_HORIZONTAL')
    expect(magnetAt(BOX, { x: -8, y: 30 }, 1)).toBe('AUTO_HORIZONTAL')
    expect(magnetAt(BOX, { x: 4, y: 100 }, 1)).toBe('LEFT')
    expect(magnetAt(BOX, { x: 100, y: -8 }, 1)).toBe('TOP')
  })

  test('further outside an end stays free', () => {
    expect(magnetAt(BOX, { x: 210, y: 100 }, 1)).toBeNull()
    expect(magnetAt(BOX, { x: -8, y: -8 }, 1)).toBeNull()
  })

  test('a straight connector attaches by centres', () => {
    const { editor, page, a } = setup()
    const { endpoint } = connectorAttachment(editor.graph, page, { x: 30, y: 16 }, {
      zoom: 1,
      straight: true
    })
    expect(endpoint).toEqual({ nodeId: a.id, magnet: 'CENTER', position: { x: 0, y: 0 } })
  })
})

describe('the connector tool', () => {
  test('a drag from one layer to another joins them in one undo step and stays on', () => {
    const { editor, a, b } = setup()
    editor.setTool('CONNECTOR')
    editor.connectorBegin(100, 100)
    editor.connectorDrag(300, 150)
    editor.connectorDrag(600, 200)
    editor.connectorRelease(600, 200, true)
    const [connector] = connectors(editor)
    expect(connector.connectorStart).toMatchObject({ nodeId: a.id, magnet: 'AUTO' })
    expect(connector.connectorEnd).toMatchObject({ nodeId: b.id, magnet: 'AUTO' })
    expect([connector.connectorStartCap, connector.connectorEndCap]).toEqual(['NONE', 'ARROW_LINES'])
    expect(editor.state.activeTool).toBe('CONNECTOR')
    editor.undoAction()
    expect(connectors(editor)).toHaveLength(0)
    editor.redoAction()
    expect(connectors(editor)).toHaveLength(1)
  })

  test('a click starts a connector that follows the pointer to the next click', () => {
    const { editor, b } = setup()
    editor.setTool('CONNECTOR')
    editor.connectorBegin(300, 400)
    editor.connectorRelease(300, 400, false)
    expect(connectors(editor)).toHaveLength(0)
    editor.connectorHover(450, 400)
    expect(connectors(editor)).toHaveLength(1)
    editor.connectorBegin(600, 200)
    editor.connectorRelease(600, 200, false)
    const [connector] = connectors(editor)
    expect(connector.connectorStart).toMatchObject({ nodeId: null, position: { x: 300, y: 400 } })
    expect(connector.connectorEnd).toMatchObject({ nodeId: b.id })
  })

  test('changing tool drops a connector a click started', () => {
    const { editor } = setup()
    editor.setTool('CONNECTOR')
    editor.connectorBegin(300, 400)
    editor.connectorRelease(300, 400, false)
    editor.connectorHover(450, 400)
    editor.setTool('SELECT')
    expect(connectors(editor)).toHaveLength(0)
  })
})

describe('dragging a connector end', () => {
  test('attaches it where it is dropped, and undo puts it back', () => {
    const { editor, a, b } = setup()
    editor.setTool('CONNECTOR')
    editor.connectorBegin(100, 100)
    editor.connectorRelease(900, 600, true)
    const [connector] = connectors(editor)
    expect(connector.connectorEnd?.nodeId).toBeNull()
    editor.setTool('SELECT')
    editor.connectorEndpointBegin(connector.id, 'connectorEnd')
    editor.connectorEndpointDrag(600, 200)
    expect(editor.state.connectorTarget).toEqual({ nodeId: b.id, magnet: 'AUTO' })
    editor.connectorEndpointCommit()
    expect(editor.graph.getNode(connector.id)?.connectorEnd?.nodeId).toBe(b.id)
    expect(editor.state.connectorTarget).toBeNull()
    editor.undoAction()
    expect(editor.graph.getNode(connector.id)?.connectorEnd?.nodeId).toBeNull()
    expect(editor.graph.getNode(connector.id)?.connectorStart?.nodeId).toBe(a.id)
  })
})

describe('dropping a connector end', () => {
  function framed() {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const frame = editor.graph.createNode('FRAME', page, { x: 0, y: 0, width: 1000, height: 600 })
    const a = editor.graph.createNode('RECTANGLE', frame.id, { x: 100, y: 100, width: 200, height: 200 })
    const b = editor.graph.createNode('RECTANGLE', frame.id, { x: 600, y: 100, width: 200, height: 200 })
    const connector = createConnector(editor.graph, frame.id, {
      start: boundEndpoint(a.id),
      end: boundEndpoint(b.id)
    })
    return { editor, frame, a, b, connector }
  }

  function dropEnd(editor: ReturnType<typeof createEditor>, id: string, x: number, y: number) {
    editor.connectorEndpointBegin(id, 'connectorEnd')
    editor.connectorEndpointDrag(x, y)
    editor.connectorEndpointCommit()
  }

  test('in the frame the connector sits in stays free there', () => {
    const { editor, connector } = framed()
    dropEnd(editor, connector.id, 500, 500)
    expect(editor.graph.getNode(connector.id)?.connectorEnd).toEqual(freeEndpoint(500, 500))
  })

  test('on a layer inside a frame attaches to that layer', () => {
    const { editor, connector } = framed()
    const c = editor.graph.createNode('RECTANGLE', editor.graph.getNode(connector.id)?.parentId ?? '', {
      x: 350,
      y: 400,
      width: 150,
      height: 150
    })
    dropEnd(editor, connector.id, 425, 475)
    expect(editor.graph.getNode(connector.id)?.connectorEnd).toMatchObject({ nodeId: c.id, magnet: 'AUTO' })
  })

  test('on the layer its other end joins deletes the connector, and undo brings it back', () => {
    const { editor, a, b, connector } = framed()
    dropEnd(editor, connector.id, 200, 200)
    expect(editor.graph.getNode(connector.id)).toBeUndefined()
    editor.undoAction()
    const restored = editor.graph.getNode(connector.id)
    expect(restored?.connectorStart?.nodeId).toBe(a.id)
    expect(restored?.connectorEnd?.nodeId).toBe(b.id)
  })
})
