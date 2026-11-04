import { afterEach, expect, test } from 'bun:test'

import { createEditor, type Editor } from '@open-pencil/core'
import { boundEndpoint, createConnector, freeEndpoint } from '@open-pencil/scene-graph/connectors'

import { refreshConnectorDrag, startConnectorDraw } from '#vue/shared/input/connector/draw'
import type { DragState } from '#vue/shared/input/types'

let editor: Editor

afterEach(() => editor.dispose())

function square() {
  editor = createEditor()
  const page = editor.state.currentPageId
  const target = editor.graph.createNode('RECTANGLE', page, { width: 200, height: 200 })
  return { page, target }
}

/** A key event as the window reports it: the key, and the modifiers held once it changed. */
const keyEvent = (key: string, held: { shiftKey?: boolean; metaKey?: boolean }) => ({
  key,
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  ...held
})

test('Shift pressed after the last move attaches a dragged end to the centre at once', () => {
  const { page, target } = square()
  const source = editor.graph.createNode('RECTANGLE', page, { x: -300, width: 50, height: 50 })
  const connector = createConnector(editor.graph, page, {
    start: boundEndpoint(source.id),
    end: freeEndpoint(-100, -100)
  })
  editor.connectorEndpointBegin(connector.id, 'connectorEnd')
  const drag: DragState = {
    type: 'connector-end',
    commit: () => editor.connectorEndpointCommit(),
    cancel: () => editor.connectorEndpointCancel()
  }
  const pointer = { cx: 60, cy: 40, sx: 60, sy: 40 }
  editor.connectorEndpointDrag(pointer.cx, pointer.cy)
  expect(editor.state.connectorTarget?.magnet).toBe('TOP')
  refreshConnectorDrag(drag, pointer, keyEvent('Shift', { shiftKey: true }), editor)
  expect(editor.state.connectorTarget).toEqual({ nodeId: target.id, magnet: 'CENTER' })
  // Letting go before the release attaches by the side again.
  refreshConnectorDrag(drag, pointer, keyEvent('Shift', {}), editor)
  editor.connectorEndpointCommit()
  expect(editor.graph.getNode(connector.id)?.connectorEnd?.magnet).toBe('TOP')
})

test('⌘ pressed after the last move pins a drawn end where the pointer is', () => {
  const { target } = square()
  editor.setTool('CONNECTOR')
  const drags: DragState[] = []
  startConnectorDraw(-300, 100, -300, 100, editor, (d) => drags.push(d), {})
  const [drag] = drags
  if (drag?.type !== 'connector-draw') throw new Error('Expected a connector draw')
  const pointer = { cx: 60, cy: 40, sx: 60, sy: 40 }
  refreshConnectorDrag(drag, pointer, keyEvent('Meta', { metaKey: true }), editor)
  drag.commit()
  const connector = [...editor.graph.getAllNodes()].find((node) => node.type === 'CONNECTOR')
  expect(connector?.connectorEnd).toEqual({
    nodeId: target.id,
    magnet: 'NONE',
    position: { x: 60, y: 40 }
  })
})
