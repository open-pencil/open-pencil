import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'
import {
  protectField,
  syncNodeProps,
  type ProtectionMap
} from '@open-pencil/fig/instance-overrides'
import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Fill, Stroke } from '@open-pencil/scene-graph'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

const redFill: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

const blueFill: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0, b: 1, a: 1 },
  opacity: 1,
  visible: true,
  blendMode: 'NORMAL'
}

const redStroke: Stroke = {
  color: { r: 1, g: 0, b: 0, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER',
  cap: 'NONE',
  join: 'MITER',
  dashPattern: []
}

const blueStroke: Stroke = {
  color: { r: 0, g: 0, b: 1, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER',
  cap: 'NONE',
  join: 'MITER',
  dashPattern: []
}

describe('fig import override field protection', () => {
  test('explicit instance strokes survive component synchronization', () => {
    const graph = importNodeChanges([
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Document' } as NodeChange,
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page'
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Button',
        strokePaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1 }]
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 2 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'INSTANCE',
        name: 'Button instance',
        symbolData: { symbolID: { sessionID: 1, localID: 1 } },
        strokePaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 0.4 }]
      } as NodeChange
    ])

    const instance = graph
      .getChildren(graph.getPages()[0].id)
      .find((node) => node.type === 'INSTANCE')
    expect(instance?.strokes[0]?.color).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(instance?.strokes[0]?.opacity).toBe(0.4)
  })

  test('protected text still inherits fills', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('TEXT', pageId(graph), {
      text: 'Source',
      fills: [redFill],
      boundVariables: { 'fills/0/color': 'source-color' }
    })
    const target = graph.createNode('TEXT', pageId(graph), {
      text: 'Override',
      fills: [blueFill],
      boundVariables: { 'fills/0/color': 'target-color', width: 'target-width' }
    })
    const protections: ProtectionMap = new Map()
    protectField(protections, target.id, 'text')

    syncNodeProps(graph, source, target, protections)

    const synced = graph.getNode(target.id)
    expect(synced?.text).toBe('Override')
    expect(synced?.fills[0]?.color).toEqual(redFill.color)
    expect(synced?.boundVariables).toEqual({
      'fills/0/color': 'source-color',
      width: 'target-width'
    })
  })

  test('protected strokes still inherit visibility', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('RECTANGLE', pageId(graph), {
      visible: false,
      strokes: [redStroke]
    })
    const target = graph.createNode('RECTANGLE', pageId(graph), {
      visible: true,
      strokes: [blueStroke]
    })
    const protections: ProtectionMap = new Map()
    protectField(protections, target.id, 'strokes')

    syncNodeProps(graph, source, target, protections)

    const synced = graph.getNode(target.id)
    expect(synced?.visible).toBe(false)
    expect(synced?.strokes[0]?.color).toEqual(blueStroke.color)
  })
})
