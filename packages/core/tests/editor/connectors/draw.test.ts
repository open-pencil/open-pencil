import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { boundEndpoint, createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

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

// Measured by dragging a connector end in Figma Design onto 200 and 400 px squares at 100% and
// 200% on 2026-10-25.
describe('where a connector end attaches', () => {
  test('points inside take the nearest side, ties going top, right, bottom, then left', () => {
    expect(magnetAt(BOX, { x: 100, y: 30 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 30, y: 100 }, 1)).toBe('LEFT')
    expect(magnetAt(BOX, { x: 150, y: 60 }, 1)).toBe('RIGHT')
    expect(magnetAt(BOX, { x: 40, y: 4 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 196, y: 10 }, 1)).toBe('RIGHT')
    expect(magnetAt(BOX, { x: 50, y: 50 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 60, y: 140 }, 1)).toBe('BOTTOM')
    expect(magnetAt(BOX, { x: 200, y: 0 }, 1)).toBe('TOP')
  })

  test('within 24 units of the centre an end attaches by any side, at any size and zoom', () => {
    expect(magnetAt(BOX, { x: 100, y: 77 }, 1)).toBe('AUTO')
    expect(magnetAt(BOX, { x: 115, y: 115 }, 1)).toBe('AUTO')
    expect(magnetAt(BOX, { x: 100, y: 76 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 80, y: 80 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 100, y: 77 }, 2)).toBe('AUTO')
    const large = { x: 0, y: 0, width: 400, height: 400 }
    expect(magnetAt(large, { x: 200, y: 177 }, 1)).toBe('AUTO')
    expect(magnetAt(large, { x: 200, y: 176 }, 1)).toBe('TOP')
  })

  test('within 8 screen px outside an end takes the side it is past, and further out stays free', () => {
    expect(magnetAt(BOX, { x: 40, y: -7 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: 204, y: 0 }, 1)).toBe('RIGHT')
    expect(magnetAt(BOX, { x: -4, y: -4 }, 1)).toBe('TOP')
    expect(magnetAt(BOX, { x: -5, y: 0 }, 1)).toBe('LEFT')
    expect(magnetAt(BOX, { x: 100, y: -8.5 }, 1)).toBeNull()
    expect(magnetAt(BOX, { x: -8, y: -8 }, 1)).toBeNull()
    expect(magnetAt(BOX, { x: 100, y: -3 }, 2)).toBe('TOP')
    expect(magnetAt(BOX, { x: 100, y: -4.5 }, 2)).toBeNull()
  })

  test('a straight connector attaches by centres', () => {
    const { editor, page, a } = setup()
    const { endpoint } = connectorAttachment(
      editor.graph,
      page,
      { x: 30, y: 16 },
      {
        zoom: 1,
        straight: true
      }
    )
    expect(endpoint).toEqual({ nodeId: a.id, magnet: 'CENTER', position: { x: 0, y: 0 } })
  })

  test('⌘ pins an end at the point, held within the layer, and Shift centres it', () => {
    const { editor, page, a } = setup()
    const at = (x: number, y: number, modifiers: { pin?: boolean; centre?: boolean }) =>
      connectorAttachment(editor.graph, page, { x, y }, { zoom: 1, ...modifiers }).endpoint
    expect(at(60, 40, { pin: true })).toEqual({ nodeId: a.id, magnet: 'NONE', position: { x: 60, y: 40 } })
    expect(at(100, -4, { pin: true })).toEqual({ nodeId: a.id, magnet: 'NONE', position: { x: 100, y: 0 } })
    expect(at(100, -20, { pin: true }).nodeId).toBeNull()
    expect(at(60, 40, { centre: true })).toMatchObject({ nodeId: a.id, magnet: 'CENTER' })
  })
})

// Measured with FigJam's connector tool on a 400 × 320 section at 100% on 2026-10-19.
describe('where a connector end attaches inside a section', () => {
  const SECTION = { x: 0, y: 0, width: 400, height: 320 }

  test('near its outline it attaches as to any layer', () => {
    expect(magnetAt(SECTION, { x: 212, y: 10 }, 1, true)).toBe('TOP')
    expect(magnetAt(SECTION, { x: 220, y: 10 }, 1, true)).toBe('AUTO_HORIZONTAL')
    expect(magnetAt(SECTION, { x: 200, y: 312 }, 1, true)).toBe('BOTTOM')
  })

  test('near its centre it takes the nearest side, and elsewhere it is pinned', () => {
    expect(magnetAt(SECTION, { x: 200, y: 160 }, 1, true)).toBe('TOP')
    expect(magnetAt(SECTION, { x: 216, y: 160 }, 1, true)).toBe('TOP')
    expect(magnetAt(SECTION, { x: 224, y: 160 }, 1, true)).toBe('ABSOLUTE')
    expect(magnetAt(SECTION, { x: 20, y: 168 }, 1, true)).toBe('ABSOLUTE')
    expect(magnetAt(SECTION, { x: 40, y: 288 }, 1, true)).toBe('ABSOLUTE')
  })

  test("a pinned end keeps the point in the section's own axes", () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const section = editor.graph.createNode('SECTION', page, { x: 480, y: -100, width: 400, height: 320 })
    expect(connectorAttachment(editor.graph, page, { x: 520, y: 158 }, { zoom: 1 })).toEqual({
      endpoint: { nodeId: section.id, magnet: 'ABSOLUTE', position: { x: 40, y: 258 } },
      target: { nodeId: section.id, magnet: 'ABSOLUTE' }
    })
    editor.dispose()
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
    expect([connector.connectorStartCap, connector.connectorEndCap]).toEqual([
      'NONE',
      'ARROW_LINES'
    ])
    expect(editor.state.activeTool).toBe('CONNECTOR')
    editor.undoAction()
    expect(connectors(editor)).toHaveLength(0)
    editor.redoAction()
    expect(connectors(editor)).toHaveLength(1)
  })

  test('a drag within one layer keeps a connector from side to side, as FigJam does', () => {
    const { editor, a } = setup()
    editor.setTool('CONNECTOR')
    editor.connectorBegin(45, 100)
    editor.connectorDrag(155, 100)
    editor.connectorRelease(155, 100, true)
    const [connector] = connectors(editor)
    expect(connector.connectorStart).toMatchObject({ nodeId: a.id, magnet: 'LEFT' })
    expect(connector.connectorEnd).toMatchObject({ nodeId: a.id, magnet: 'RIGHT' })
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
    const { editor, a } = setup()
    editor.select([a.id])
    editor.setTool('CONNECTOR')
    editor.connectorBegin(300, 400)
    editor.connectorRelease(300, 400, false)
    editor.connectorHover(450, 400)
    editor.setTool('SELECT')
    expect(connectors(editor)).toHaveLength(0)
    // The selection the drawing cleared comes back.
    expect([...editor.state.selectedIds]).toEqual([a.id])
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
    const a = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 100,
      y: 100,
      width: 200,
      height: 200
    })
    const b = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 600,
      y: 100,
      width: 200,
      height: 200
    })
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
    const c = editor.graph.createNode(
      'RECTANGLE',
      editor.graph.getNode(connector.id)?.parentId ?? '',
      {
        x: 350,
        y: 400,
        width: 150,
        height: 150
      }
    )
    dropEnd(editor, connector.id, 425, 475)
    expect(editor.graph.getNode(connector.id)?.connectorEnd).toMatchObject({
      nodeId: c.id,
      magnet: 'AUTO'
    })
  })

  test('on a layer outside a frame that does not clip attaches to that layer', () => {
    const { editor, frame, connector } = framed()
    editor.graph.updateNode(frame.id, { clipsContent: false })
    const outside = editor.graph.createNode('RECTANGLE', frame.id, {
      x: 1100,
      y: 100,
      width: 100,
      height: 100
    })
    dropEnd(editor, connector.id, 1150, 150)
    expect(editor.graph.getNode(connector.id)?.connectorEnd).toMatchObject({
      nodeId: outside.id,
      magnet: 'AUTO'
    })
  })

  test('pressing and releasing an end without moving keeps a connector whose ends share a layer', () => {
    const { editor, a, connector } = framed()
    editor.graph.updateNode(connector.id, { connectorEnd: boundEndpoint(a.id, 'RIGHT') })
    editor.connectorEndpointBegin(connector.id, 'connectorEnd')
    editor.connectorEndpointCommit()
    expect(editor.graph.getNode(connector.id)).toBeDefined()
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
