import { afterEach, describe, expect, test } from 'bun:test'

import {
  boundEndpoint,
  buildConnectorSublayers,
  freeEndpoint
} from '@open-pencil/scene-graph/connectors'

import { createMoveHarness, type MoveHarness } from './harness'

// Each case replays an interaction observed in FigJam with real pointer input.

let h: MoveHarness

afterEach(() => h.editor.dispose())

const settle = () => Promise.resolve()

/** A box with a connector from its right side to a free point below and to the right. */
async function setup() {
  h = createMoveHarness()
  const { editor, node, page } = h
  const box = node('RECTANGLE', page, { x: 0, y: 0, width: 100, height: 100 })
  const other = node('RECTANGLE', page, { x: 600, y: 0, width: 100, height: 100 })
  const connector = editor.graph.createNode('CONNECTOR', page, {
    connectorStart: boundEndpoint(box.id)
  })
  buildConnectorSublayers(editor.graph, connector)
  // Routes it, as an edit to its ends does.
  editor.updateNode(connector.id, { connectorEnd: freeEndpoint(400, 300) })
  await settle()
  return { box, other, connector }
}

function freeEnd(id: string) {
  return h.editor.graph.getNode(id)?.connectorEnd?.position
}

describe('moving connectors', () => {
  test('a connector held by a layer stays put when dragged alone', async () => {
    const { connector } = await setup()
    const before = h.editor.graph.getNode(connector.id)?.x
    h.drag([connector.id], [250, 200], [330, 260])
    await settle()
    expect(freeEnd(connector.id)).toEqual({ x: 400, y: 300 })
    expect(h.editor.graph.getNode(connector.id)?.x).toBe(before)
  })

  test('dragged with another layer, its free end moves by the drag once', async () => {
    const { connector, other } = await setup()
    h.drag([other.id, connector.id], [650, 50], [730, 110])
    await settle()
    expect(freeEnd(connector.id)).toEqual({ x: 480, y: 360 })
    h.editor.undoAction()
    await settle()
    expect(freeEnd(connector.id)).toEqual({ x: 400, y: 300 })
  })

  test('a connector with only free ends drags on its own', async () => {
    const { connector } = await setup()
    h.editor.updateNode(connector.id, { connectorStart: freeEndpoint(200, 300) })
    await settle()
    h.drag([connector.id], [300, 300], [380, 360])
    await settle()
    expect(h.editor.graph.getNode(connector.id)?.connectorStart?.position).toEqual({
      x: 280,
      y: 360
    })
    expect(freeEnd(connector.id)).toEqual({ x: 480, y: 360 })
  })
})
