import { describe, expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

import {
  axisSizingForNode,
  axisSizingPatchForNode,
  sizingOptionsForNode
} from '#vue/controls/layout/helpers'

function setup(parentMode: SceneNode['layoutMode'], child: Partial<SceneNode> = {}) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const parent = graph.createNode('FRAME', page.id, {
    layoutMode: parentMode,
    width: 300,
    height: 200
  })
  const node = graph.createNode('FRAME', parent.id, { width: 100, height: 100, ...child })
  return { graph, node }
}

function options(graph: SceneGraph, node: SceneNode) {
  return sizingOptionsForNode(graph, node).map((option) => option.value)
}

describe('layout sizing controls', () => {
  test('a frame outside auto-layout only shows its fixed size', () => {
    const { graph, node } = setup('NONE', { childIds: ['child'] })

    expect(options(graph, node)).toEqual(['FIXED'])
  })

  test('an auto-layout child offers fill, and hug once it has its own auto-layout', () => {
    const plain = setup('HORIZONTAL')
    expect(options(plain.graph, plain.node)).toEqual(['FIXED', 'FILL'])

    const stack = setup('HORIZONTAL', { layoutMode: 'VERTICAL' })
    expect(options(stack.graph, stack.node)).toEqual(['FIXED', 'HUG', 'FILL'])
  })

  test('fill is stored on the child per axis, as grow along the parent and stretch across it', () => {
    const { graph, node } = setup('HORIZONTAL')

    expect(axisSizingPatchForNode(graph, node, 'width', 'FILL')).toEqual({ layoutGrow: 1 })
    expect(axisSizingPatchForNode(graph, node, 'height', 'FILL')).toEqual({
      layoutAlignSelf: 'STRETCH'
    })
  })

  test('grid cells fill their width by grow and their height by stretch', () => {
    const { graph, node } = setup('GRID', { layoutAlignSelf: 'STRETCH' })

    expect(axisSizingForNode(graph, node, 'width')).toBe('FIXED')
    expect(axisSizingForNode(graph, node, 'height')).toBe('FILL')
    expect(axisSizingPatchForNode(graph, node, 'width', 'FILL')).toEqual({ layoutGrow: 1 })
  })

  test('editing a filled and hugged stack switches only that axis to fixed', () => {
    const { graph, node } = setup('HORIZONTAL', {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      layoutGrow: 1
    })

    expect(axisSizingForNode(graph, node, 'width')).toBe('FILL')
    expect(axisSizingForNode(graph, node, 'height')).toBe('HUG')
    expect(axisSizingPatchForNode(graph, node, 'width', 'FIXED')).toEqual({ layoutGrow: 0 })
    expect(axisSizingPatchForNode(graph, node, 'height', 'FIXED')).toEqual({
      primaryAxisSizing: 'FIXED'
    })
  })

  test('switching a stack from fill to hug clears the fill', () => {
    const { graph, node } = setup('VERTICAL', {
      layoutMode: 'HORIZONTAL',
      layoutAlignSelf: 'STRETCH'
    })

    expect(axisSizingPatchForNode(graph, node, 'width', 'HUG')).toEqual({
      layoutAlignSelf: 'AUTO',
      primaryAxisSizing: 'HUG'
    })
  })
})
