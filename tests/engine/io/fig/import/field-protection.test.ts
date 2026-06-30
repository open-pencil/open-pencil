import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import type { Fill, Stroke } from '@open-pencil/scene-graph'

import { protectField, type ProtectionMap } from '#core/kiwi/fig/instance-overrides/patches'
import { syncNodeProps } from '#core/kiwi/fig/instance-overrides/sync'

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
  test('protected text still inherits fills', () => {
    const graph = new SceneGraph()
    const source = graph.createNode('TEXT', pageId(graph), {
      text: 'Source',
      fills: [redFill]
    })
    const target = graph.createNode('TEXT', pageId(graph), {
      text: 'Override',
      fills: [blueFill]
    })
    const protections: ProtectionMap = new Map()
    protectField(protections, target.id, 'text')

    syncNodeProps(graph, source, target, protections)

    const synced = graph.getNode(target.id)
    expect(synced?.text).toBe('Override')
    expect(synced?.fills[0]?.color).toEqual(redFill.color)
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
