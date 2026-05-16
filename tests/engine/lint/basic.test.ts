import { describe, expect, test } from 'bun:test'

import { SceneGraph, createLinter } from '@open-pencil/core'

describe('createLinter', () => {
  test('reports default names and empty frames', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, { name: 'Frame 1', width: 100, height: 100 })

    const result = createLinter({ preset: 'recommended' }).lintGraph(graph, [frame.id])
    const ruleIds = result.messages.map((message) => message.ruleId)

    expect(ruleIds).toContain('no-default-names')
    expect(ruleIds).toContain('no-empty-frames')
  })

  test('reports color contrast issues for low-contrast text', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      name: 'Card',
      width: 200,
      height: 80,
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 1, g: 1, b: 1 } }]
    })
    graph.createNode('TEXT', frame.id, {
      name: 'Label',
      width: 80,
      height: 20,
      text: 'Hello',
      fills: [{ type: 'SOLID', visible: true, opacity: 1, color: { r: 0.8, g: 0.8, b: 0.8 } }]
    })

    const result = createLinter({ preset: 'recommended' }).lintGraph(graph, [frame.id])
    expect(result.messages.some((message) => message.ruleId === 'color-contrast')).toBe(true)
  })
})
