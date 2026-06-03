import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph } from '@inkly/core'

describe('imported auto-layout bounds', () => {
  test('preserves visible hug container bounds when hidden children would collapse layout', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 280,
      height: 44,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      paddingTop: 2,
      paddingRight: 2,
      paddingBottom: 2,
      paddingLeft: 2,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokes: [
        {
          color: { r: 0.58, g: 0.64, b: 0.72, a: 1 },
          weight: 2,
          opacity: 1,
          visible: true,
          align: 'OUTSIDE'
        }
      ],
      figmaDerivedLayout: { x: 0, y: 0, width: 280, height: 44 }
    })
    const wrapper = graph.createNode('FRAME', frame.id, {
      x: 2,
      y: 2,
      width: 276,
      height: 40,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const field = graph.createNode('FRAME', wrapper.id, {
      width: 276,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH',
      paddingTop: 8,
      paddingRight: 56,
      paddingBottom: 8,
      paddingLeft: 12,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 1, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokes: [
        {
          color: { r: 0.8, g: 0.84, b: 0.88, a: 1 },
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'OUTSIDE'
        }
      ],
      figmaDerivedLayout: { x: 0, y: 0, width: 276, height: 40 }
    })
    graph.createNode('TEXT', field.id, {
      x: 12,
      y: 8,
      width: 132,
      height: 24,
      text: 'typing something',
      visible: false
    })
    graph.createNode('LINE', field.id, {
      x: 12,
      y: 8,
      width: 24,
      height: 0,
      rotation: 90,
      strokes: [
        {
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'CENTER'
        }
      ]
    })

    computeAllLayouts(graph)

    expect(graph.getNode(field.id)).toMatchObject({ x: 0, y: 0, width: 276, height: 40 })
  })

  test('uses Yoga positions for imported instances while preserving imported size', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('FRAME', page.id, {
      width: 200,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'MAX',
      counterAxisAlign: 'CENTER'
    })
    const instance = graph.createNode('INSTANCE', row.id, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      figmaDerivedLayout: { x: 0, y: 0, width: 40, height: 20 }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(instance.id)).toMatchObject({ x: 160, y: 10, width: 40, height: 20 })
  })
})
