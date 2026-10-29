import { describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '@open-pencil/core'
import type { SceneNode } from '@open-pencil/scene-graph'
import {
  boundEndpoint,
  buildConnectorSublayers,
  connectorSublayers,
  layoutConnector
} from '@open-pencil/scene-graph/connectors'

type Editor = ReturnType<typeof createEditor>

/**
 * Two 160 px boxes, the second below and to the right, joined by a connector from the first's
 * right side to the second's left, as the drags were measured in FigJam.
 */
function setup(lineType: SceneNode['connectorLineType'] = 'ELBOWED') {
  const editor = createEditor()
  const page = editor.state.currentPageId
  const graph = editor.graph
  const from = graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 160, height: 160 })
  const to = graph.createNode('RECTANGLE', page, { x: 480, y: 320, width: 160, height: 160 })
  const connector = graph.createNode('CONNECTOR', page, {
    connectorStart: boundEndpoint(from.id),
    connectorEnd: boundEndpoint(to.id),
    connectorLineType: lineType
  })
  buildConnectorSublayers(graph, connector)
  layoutConnector(graph, connector)
  return { editor, from, to, connector }
}

const settle = () => Promise.resolve()

/** The line's points in page coordinates. */
function route(editor: Editor, connector: SceneNode): number[][] {
  const node = expectDefined(editor.graph.getNode(connector.id))
  const { line } = expectDefined(connectorSublayers(editor.graph, node))
  return (line.vectorNetwork?.vertices ?? []).map((vertex) => [
    Math.round((node.x + line.x + vertex.x) * 100) / 100,
    Math.round((node.y + line.y + vertex.y) * 100) / 100
  ])
}

/** The connector's control points in page coordinates. */
function controls(editor: Editor, connector: SceneNode) {
  const node = expectDefined(editor.graph.getNode(connector.id))
  return node.connectorControlPoints.map(({ position, direction }) => [
    direction,
    position.x + node.x,
    position.y + node.y
  ])
}

async function drag(
  editor: Editor,
  connector: SceneNode,
  part: Parameters<Editor['connectorLineBegin']>[1],
  from: [number, number],
  to: [number, number]
) {
  editor.connectorLineBegin(connector.id, part, ...from)
  editor.connectorLineDrag(...to)
  await settle()
  editor.connectorLineCommit()
  await settle()
}

describe('dragging a connector segment', () => {
  test('moves a middle segment across, and undo puts it back', async () => {
    const { editor, connector } = setup()
    try {
      const before = route(editor, connector)
      await drag(editor, connector, { kind: 'segment', index: 1 }, [320, 240], [352.4, 250])
      expect(controls(editor, connector)).toEqual([['VERTICAL', 352, 240]])
      expect(route(editor, connector)).toEqual([
        [166, 80],
        [352, 80],
        [352, 400],
        [473.5, 400]
      ])
      editor.undoAction()
      await settle()
      expect(controls(editor, connector)).toEqual([])
      expect(route(editor, connector)).toEqual(before)
    } finally {
      editor.dispose()
    }
  })

  test('splits a first segment a stub out of its layer, as FigJam does', async () => {
    const { editor, connector } = setup()
    try {
      await drag(editor, connector, { kind: 'segment', index: 0 }, [240, 80], [240, 16])
      expect(controls(editor, connector)).toEqual([
        ['VERTICAL', 208, 48],
        ['HORIZONTAL', 264, 16],
        ['VERTICAL', 320, 208]
      ])
      expect(route(editor, connector)).toEqual([
        [166, 80],
        [208, 80],
        [208, 16],
        [320, 16],
        [320, 400],
        [473.5, 400]
      ])
    } finally {
      editor.dispose()
    }
  })

  test('keeps the route an edit gives it, and undo of the edit gives the old one back', async () => {
    const { editor, to, connector } = setup()
    try {
      await drag(editor, connector, { kind: 'segment', index: 1 }, [320, 240], [352, 240])
      editor.updateNodeWithUndo(to.id, { y: 400 }, 'Move')
      await settle()
      // The segment across to the moved layer's top is now kept too.
      expect(controls(editor, connector)).toEqual([
        ['VERTICAL', 352, 216],
        ['HORIZONTAL', 456, 352]
      ])
      editor.undoAction()
      await settle()
      expect(controls(editor, connector)).toEqual([['VERTICAL', 352, 240]])
      expect(route(editor, connector)).toEqual([
        [166, 80],
        [352, 80],
        [352, 400],
        [473.5, 400]
      ])
      editor.redoAction()
      await settle()
      expect(controls(editor, connector)).toEqual([
        ['VERTICAL', 352, 216],
        ['HORIZONTAL', 456, 352]
      ])
    } finally {
      editor.dispose()
    }
  })

  test('a connector never dragged keeps routing itself', async () => {
    const { editor, to, connector } = setup()
    try {
      editor.updateNodeWithUndo(to.id, { y: 400 }, 'Move')
      await settle()
      expect(controls(editor, connector)).toEqual([])
    } finally {
      editor.dispose()
    }
  })

  test('moves with the connector and the layers it joins', async () => {
    const { editor, from, to, connector } = setup()
    try {
      await drag(editor, connector, { kind: 'segment', index: 1 }, [320, 240], [352, 240])
      const node = expectDefined(editor.graph.getNode(connector.id))
      editor.updateNodeWithUndo(from.id, { x: 96, y: 48 }, 'Move')
      editor.updateNodeWithUndo(to.id, { x: 576, y: 368 }, 'Move')
      editor.updateNodeWithUndo(connector.id, { x: node.x + 96, y: node.y + 48 }, 'Move')
      await settle()
      expect(route(editor, connector)).toEqual([
        [262, 128],
        [448, 128],
        [448, 448],
        [569.5, 448]
      ])
    } finally {
      editor.dispose()
    }
  })
})

describe('dragging a curved connector', () => {
  test('moves both control points by 4/3 of the drag, and undo straightens it back', async () => {
    const { editor, connector } = setup('CURVED')
    try {
      const before = route(editor, connector)
      await drag(editor, connector, { kind: 'curve' }, [320, 240], [400, 160])
      const node = expectDefined(editor.graph.getNode(connector.id))
      const handles = expectDefined(node.connectorCurveHandles).map(({ x, y }) => [
        Math.round((x + node.x) * 100) / 100,
        Math.round((y + node.y) * 100) / 100
      ])
      expect(handles).toEqual([
        [459.76, -26.67],
        [393.58, 293.33]
      ])
      editor.undoAction()
      await settle()
      expect(editor.graph.getNode(connector.id)?.connectorCurveHandles).toBeNull()
      expect(route(editor, connector)).toEqual(before)
    } finally {
      editor.dispose()
    }
  })
})

describe('dragging a connector label', () => {
  test('slides it along the line or off to one side, and undo puts it back', async () => {
    const editor = createEditor()
    try {
      const page = editor.state.currentPageId
      const graph = editor.graph
      const from = graph.createNode('RECTANGLE', page, { x: 0, y: 0, width: 160, height: 160 })
      const to = graph.createNode('RECTANGLE', page, { x: 480, y: 0, width: 160, height: 160 })
      const connector = graph.createNode('CONNECTOR', page, {
        connectorStart: boundEndpoint(from.id),
        connectorEnd: boundEndpoint(to.id)
      })
      buildConnectorSublayers(graph, connector, { label: { text: 'detour', width: 50, height: 24 } })
      layoutConnector(graph, connector)
      await drag(editor, connector, { kind: 'label' }, [320, 80], [420, 80])
      const position = () => editor.graph.getNode(connector.id)?.connectorLabelPosition
      expect(position()).toMatchObject({ section: 'MIDDLE_TO_END', offAxis: 'NONE' })
      expect(position()?.offset).toBeCloseTo(100 / 153.75, 3)
      await drag(editor, connector, { kind: 'label' }, [420, 80], [420, 140])
      expect(position()?.offAxis).toBe('BELOW')
      // Beside the line, the line runs on uncut.
      expect(route(editor, connector)).toEqual([
        [166, 80],
        [473.5, 80]
      ])
      editor.undoAction()
      editor.undoAction()
      await settle()
      expect(position()).toBeNull()
    } finally {
      editor.dispose()
    }
  })
})
