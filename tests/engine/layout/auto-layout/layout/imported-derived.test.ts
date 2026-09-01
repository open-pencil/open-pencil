import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph } from '@open-pencil/core'
import { getAbsolutePositionFull } from '@open-pencil/scene-graph'

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
      derivedLayout: { x: 0, y: 0, width: 280, height: 44 }
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
      derivedLayout: { x: 0, y: 0, width: 276, height: 40 }
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

  test('uses imported HUG dimensions when positioning following siblings', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const column = graph.createNode('FRAME', page.id, {
      width: 200,
      height: 100,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    graph.createNode('FRAME', column.id, {
      width: 200,
      height: 1,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      paddingTop: 4,
      paddingBottom: 4,
      strokes: [
        {
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 1,
          opacity: 1,
          visible: true,
          align: 'CENTER'
        }
      ],
      derivedLayout: { x: 0, y: 0, width: 200, height: 1 }
    })
    const following = graph.createNode('RECTANGLE', column.id, { width: 200, height: 20 })

    computeAllLayouts(graph)

    expect(graph.getNode(following.id)?.y).toBe(1)
  })

  test('positions generated fill children from exact imported dimensions and gaps', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('FRAME', page.id, {
      width: 288,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 16
    })
    const first = graph.createNode('INSTANCE', row.id, {
      width: 136,
      height: 14,
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      derivedLayout: { width: 136, height: 14 }
    })
    const second = graph.createNode('INSTANCE', row.id, {
      width: 136,
      height: 40,
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      derivedLayout: { width: 136, height: 40 }
    })
    graph.createNode('RECTANGLE', first.id, { width: 200, height: 14 })

    computeAllLayouts(graph)

    expect(graph.getNode(first.id)).toMatchObject({ x: 0, width: 136 })
    expect(graph.getNode(second.id)).toMatchObject({ x: 152, width: 136 })
  })

  test('uses exact imported dimensions with space-between despite stored spacing', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('FRAME', page.id, {
      width: 288,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      primaryAxisAlign: 'SPACE_BETWEEN',
      itemSpacing: 16
    })
    const first = graph.createNode('INSTANCE', row.id, {
      width: 136,
      height: 40,
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      derivedLayout: { width: 136, height: 40 }
    })
    const second = graph.createNode('INSTANCE', row.id, {
      width: 152,
      height: 40,
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      derivedLayout: { width: 152, height: 40 }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(first.id)).toMatchObject({ x: 0, width: 136 })
    expect(graph.getNode(second.id)).toMatchObject({ x: 136, width: 152 })
  })

  test('keeps normal flex sizing when imported dimensions do not fit the parent', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('FRAME', page.id, {
      width: 320,
      height: 40,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 16
    })
    const first = graph.createNode('INSTANCE', row.id, {
      width: 136,
      height: 14,
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      derivedLayout: { width: 136, height: 14 }
    })
    const second = graph.createNode('INSTANCE', row.id, {
      width: 136,
      height: 40,
      layoutMode: 'HORIZONTAL',
      layoutGrow: 1,
      derivedLayout: { width: 136, height: 40 }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(first.id)).toMatchObject({ x: 0, width: 136 })
    expect(graph.getNode(second.id)).toMatchObject({ x: 168, width: 136 })
  })

  test('stretches generated children inside authoritative imported bounds', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const column = graph.createNode('INSTANCE', page.id, {
      width: 302,
      height: 60,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      derivedLayout: { width: 302, height: 60 }
    })
    const label = graph.createNode('INSTANCE', column.id, {
      width: 280,
      height: 14,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH'
    })

    computeAllLayouts(graph)

    expect(graph.getNode(label.id)).toMatchObject({ x: 0, width: 302 })
  })

  test('does not infer authoritative stretch without generated parent bounds', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const column = graph.createNode('FRAME', page.id, {
      width: 624,
      height: 290,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const label = graph.createNode('INSTANCE', column.id, {
      width: 44,
      height: 14,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH'
    })

    computeAllLayouts(graph)

    expect(graph.getNode(label.id)?.width).toBe(44)
  })

  test('preserves hidden child geometry while excluding it from parent flow', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const column = graph.createNode('FRAME', page.id, {
      width: 280,
      height: 40,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED'
    })
    const label = graph.createNode('INSTANCE', column.id, {
      width: 280,
      height: 14,
      visible: false,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG'
    })
    graph.createNode('TEXT', label.id, {
      width: 37,
      height: 14,
      text: 'Label',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      derivedLayout: { x: 0, y: 0, width: 37, height: 14 }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(label.id)).toMatchObject({ width: 280, height: 14, visible: false })
  })

  test('uses exact derived width for a growing text leaf when siblings fill the parent', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('INSTANCE', page.id, {
      width: 224,
      height: 32,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      itemSpacing: 8,
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8
    })
    graph.createNode('INSTANCE', row.id, { width: 16, height: 16 })
    const text = graph.createNode('TEXT', row.id, {
      width: 196,
      height: 20,
      text: 'Models',
      textAutoResize: 'HEIGHT',
      layoutGrow: 1,
      derivedLayout: { width: 160, height: 20 }
    })
    const chevron = graph.createNode('INSTANCE', row.id, { width: 16, height: 16 })

    computeAllLayouts(graph)

    expect(graph.getNode(text.id)).toMatchObject({ x: 32, width: 160 })
    expect(graph.getNode(chevron.id)?.x).toBe(200)
  })

  test('lets live Yoga resize imported text when stored and derived sizes agree', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 200,
      height: 100,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      paddingLeft: 20,
      paddingRight: 20
    })
    const text = graph.createNode('TEXT', frame.id, {
      width: 424,
      height: 40,
      layoutAlignSelf: 'STRETCH',
      derivedLayout: { width: 424, height: 40 }
    })
    graph.updateNode(text.id, {
      source: { ...text.source, format: 'fig', id: '1:3' }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(text.id)).toMatchObject({ width: 160, height: 40 })
  })

  test('preserves imported HUG cross size backed by stretched derived children', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const frame = graph.createNode('FRAME', page.id, {
      width: 381,
      height: 102,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'HUG',
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24
    })
    graph.updateNode(frame.id, { source: { ...frame.source, format: 'fig' } })
    graph.createNode('TEXT', frame.id, {
      width: 333,
      height: 30,
      text: 'Bar Chart',
      textAutoResize: 'HEIGHT',
      layoutAlignSelf: 'STRETCH',
      derivedLayout: { width: 333, height: 30 }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(frame.id)?.width).toBe(381)
  })

  test('preserves direct imported frame geometry inside imported parents', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const parent = graph.createNode('FRAME', page.id, {
      width: 768,
      height: 454,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      counterAxisAlign: 'CENTER'
    })
    const child = graph.createNode('FRAME', parent.id, {
      x: 192,
      y: 40,
      width: 384,
      height: 414,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      layoutAlignSelf: 'STRETCH'
    })
    graph.updateNode(parent.id, { source: { ...parent.source, format: 'fig' } })
    graph.updateNode(child.id, { source: { ...child.source, format: 'fig' } })

    computeAllLayouts(graph)

    expect(graph.getNode(child.id)).toMatchObject({ x: 192, y: 40, width: 384, height: 414 })
  })

  test('preserves transformed bounds for rotated imported flow children', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const parent = graph.createNode('FRAME', page.id, {
      width: 17,
      height: 20,
      layoutMode: 'HORIZONTAL',
      primaryAxisSizing: 'FIXED',
      counterAxisSizing: 'FIXED',
      paddingLeft: 16
    })
    const separator = graph.createNode('INSTANCE', parent.id, {
      x: 6.5,
      y: 9.5,
      width: 20,
      height: 1,
      rotation: -90
    })
    graph.updateNode(separator.id, {
      source: { ...separator.source, format: 'fig' }
    })
    const before = getAbsolutePositionFull(separator, graph)

    computeAllLayouts(graph)

    const afterNode = graph.getNode(separator.id)
    expect(afterNode).toBeDefined()
    const after = getAbsolutePositionFull(afterNode ?? separator, graph)
    expect(after).toMatchObject({
      boundX: before.boundX,
      boundY: before.boundY,
      width: before.width,
      height: before.height
    })
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
      derivedLayout: { x: 0, y: 0, width: 40, height: 20 }
    })

    computeAllLayouts(graph)

    expect(graph.getNode(instance.id)).toMatchObject({ x: 160, y: 10, width: 40, height: 20 })
  })
})
