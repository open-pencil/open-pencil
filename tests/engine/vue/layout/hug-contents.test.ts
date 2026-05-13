import { describe, expect, test } from 'bun:test'

import { widthSizingForNode, heightSizingForNode, sizingOptionsForNode } from '#vue/controls/layout/helpers'
import type { SceneNode } from '@open-pencil/core/scene-graph'

function node(overrides: Partial<SceneNode>): SceneNode {
  return {
    id: 'node',
    type: 'FRAME',
    name: 'Frame',
    parentId: 'page',
    childIds: [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    layoutMode: 'NONE',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    layoutGrow: 0,
    layoutAlignSelf: 'AUTO',
    ...overrides
  } as SceneNode
}

describe('layout sizing controls', () => {
  test('plain containers with children expose hug contents', () => {
    const frame = node({ childIds: ['child'] })

    expect(sizingOptionsForNode(frame, false).map((option) => option.value)).toContain('HUG')
  })

  test('plain container width and height reflect hug sizing fields', () => {
    const frame = node({
      childIds: ['child'],
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })

    expect(widthSizingForNode(frame, false)).toBe('HUG')
    expect(heightSizingForNode(frame, false)).toBe('HUG')
  })

  test('leaf frames do not expose hug contents', () => {
    const frame = node({ childIds: [] })

    expect(sizingOptionsForNode(frame, false).map((option) => option.value)).not.toContain('HUG')
  })
})
