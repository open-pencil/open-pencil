import { describe, expect, test } from 'bun:test'

import {
  sceneNodeToDesignDocument,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css/export'
import { SceneGraph, type ConstraintType, type Fill } from '@open-pencil/scene-graph'

function element(node: DesignNode | undefined): DesignElement {
  if (node?.type !== 'element') throw new Error('Expected an element')
  return node
}

describe('DOM projection', () => {
  test('a frame without auto layout places its layers at their coordinates', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const toggle = graph.createNode('FRAME', page.id, { name: 'Switch', width: 44, height: 24 })
    graph.createNode('ELLIPSE', toggle.id, { name: 'Knob', x: 22, y: 2, width: 20, height: 20 })

    const root = element(sceneNodeToDesignDocument(graph, toggle.id).children[0])
    expect(root.inlineStyle).toMatchObject({ position: 'relative', width: '44px' })
    expect(element(root.children[0]).inlineStyle).toMatchObject({
      position: 'absolute',
      left: '22px',
      top: '2px'
    })
  })

  test('an auto layout frame leaves its layers to flexbox', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('FRAME', page.id, { name: 'Row', layoutMode: 'HORIZONTAL' })
    graph.createNode('FRAME', row.id, { name: 'Item', x: 30, width: 10, height: 10 })

    const root = element(sceneNodeToDesignDocument(graph, row.id).children[0])
    expect(root.inlineStyle?.position).toBeUndefined()
    expect(element(root.children[0]).inlineStyle?.position).toBeUndefined()
  })

  test('children start at the cross-axis start, as auto layout places them, not stretched', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const column = graph.createNode('FRAME', page.id, { name: 'Column', layoutMode: 'VERTICAL' })

    const root = element(sceneNodeToDesignDocument(graph, column.id).children[0])
    expect(root.inlineStyle?.['align-items']).toBe('flex-start')
  })
})

describe('DOM projection constraints', () => {
  function placed(horizontalConstraint: ConstraintType, verticalConstraint: ConstraintType) {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('FRAME', page.id, { name: 'Card', width: 200, height: 100 })
    graph.createNode('RECTANGLE', card.id, {
      name: 'Bar',
      x: 20,
      y: 10,
      width: 60,
      height: 30,
      horizontalConstraint,
      verticalConstraint
    })
    const root = element(sceneNodeToDesignDocument(graph, card.id).children[0])
    return element(root.children[0]).inlineStyle ?? {}
  }

  test('Left and Top keep the start edges', () => {
    expect(placed('MIN', 'MIN')).toMatchObject({ left: '20px', top: '10px', width: '60px' })
  })

  test('Right and Bottom keep the end edges', () => {
    const style = placed('MAX', 'MAX')
    expect(style).toMatchObject({ right: '120px', bottom: '60px', width: '60px', height: '30px' })
    expect(style.left).toBeUndefined()
    expect(style.top).toBeUndefined()
  })

  test('Center keeps the offset from the centre', () => {
    expect(placed('CENTER', 'CENTER')).toMatchObject({
      left: 'calc(50% - 80px)',
      top: 'calc(50% - 40px)',
      width: '60px'
    })
  })

  test('Left and right keep both edges, with the size written out so images fill it too', () => {
    expect(placed('STRETCH', 'STRETCH')).toMatchObject({
      left: '20px',
      width: 'calc(100% - 140px)',
      top: '10px',
      height: 'calc(100% - 70px)'
    })
  })

  test('a parent with no size on an axis leaves its children at their start and size', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('FRAME', page.id, { name: 'Card', width: 0, height: 100 })
    graph.createNode('RECTANGLE', card.id, {
      name: 'Bar',
      x: 20,
      width: 60,
      height: 30,
      horizontalConstraint: 'STRETCH'
    })
    const root = element(sceneNodeToDesignDocument(graph, card.id).children[0])
    expect(element(root.children[0]).inlineStyle).toMatchObject({ left: '20px', width: '60px' })
  })

  test('offsets are measured inside the parent border, which a stroke does not take', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('FRAME', page.id, {
      name: 'Card',
      width: 200,
      height: 100,
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 0, a: 1 },
          weight: 10,
          opacity: 1,
          visible: true,
          align: 'INSIDE'
        }
      ]
    })
    graph.createNode('RECTANGLE', card.id, {
      name: 'Bar',
      x: 20,
      y: 10,
      width: 60,
      height: 30,
      horizontalConstraint: 'SCALE',
      verticalConstraint: 'MAX'
    })
    const root = element(sceneNodeToDesignDocument(graph, card.id).children[0])
    expect(element(root.children[0]).inlineStyle).toMatchObject({
      left: '5.5556%',
      width: '33.3333%',
      bottom: '50px'
    })
  })

  test('Scale keeps its share of the parent', () => {
    expect(placed('SCALE', 'SCALE')).toMatchObject({
      left: '10%',
      width: '30%',
      top: '10%',
      height: '30%'
    })
  })

  test('an absolutely positioned layer in auto layout follows its constraints too', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const row = graph.createNode('FRAME', page.id, {
      name: 'Row',
      width: 200,
      height: 40,
      layoutMode: 'HORIZONTAL'
    })
    graph.createNode('RECTANGLE', row.id, {
      name: 'Badge',
      x: 180,
      y: 0,
      width: 12,
      height: 12,
      layoutPositioning: 'ABSOLUTE',
      horizontalConstraint: 'MAX'
    })
    const root = element(sceneNodeToDesignDocument(graph, row.id).children[0])
    expect(element(root.children[0]).inlineStyle).toMatchObject({
      position: 'absolute',
      right: '8px',
      top: '0px'
    })
  })
})

describe('DOM projection sizes', () => {
  test('a hugging auto layout frame and auto-sizing text leave their size to the content', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const card = graph.createNode('FRAME', page.id, {
      name: 'Card',
      width: 240,
      height: 72,
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED'
    })
    graph.createNode('TEXT', card.id, {
      name: 'Title',
      text: 'Details',
      width: 60,
      height: 16,
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    graph.createNode('ELLIPSE', card.id, { name: 'Knob', width: 20, height: 20 })

    const root = element(sceneNodeToDesignDocument(graph, card.id).children[0])
    expect(root.inlineStyle).toMatchObject({ width: '240px' })
    expect(root.inlineStyle?.height).toBeUndefined()
    const [title, dot] = root.children.map(element)
    expect(title.inlineStyle?.width).toBeUndefined()
    expect(title.inlineStyle?.height).toBeUndefined()
    expect(dot.inlineStyle).toMatchObject({ width: '20px', 'border-radius': '50%' })
  })

  test('paints every visible fill, the top one first, the lowest colour as the background colour', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const identity = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
    const stops = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]
    const solid = (r: number, g: number, b: number, opacity = 1): Fill => ({
      type: 'SOLID',
      color: { r, g, b, a: 1 },
      opacity,
      visible: true
    })
    const gradient = (type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR'): Fill => ({
      ...solid(0, 0, 0),
      type,
      gradientTransform: identity,
      gradientStops: stops
    })
    const style = (fills: Fill[]) => {
      const node = graph.createNode('RECTANGLE', page.id, { width: 40, height: 20, fills })
      return element(sceneNodeToDesignDocument(graph, node.id).children[0]).inlineStyle
    }

    expect(style([gradient('GRADIENT_LINEAR')])).toMatchObject({
      'background-image': 'linear-gradient(90deg, #FF0000 0%, #0000FF 100%)'
    })
    expect(style([gradient('GRADIENT_RADIAL')])?.['background-image']).toBe(
      'radial-gradient(50% 50% at 50% 50%, #FF0000 0%, #0000FF 100%)'
    )
    expect(style([gradient('GRADIENT_ANGULAR')])?.['background-image']).toBe(
      'conic-gradient(from 90deg at 50% 50%, #FF0000 0%, #0000FF 100%)'
    )
    // A colour above another fill can only stack as an image of itself.
    expect(style([solid(1, 0, 0), solid(0, 0, 1, 0.5)])).toMatchObject({
      'background-image': 'linear-gradient(rgba(0, 0, 255, 0.5), rgba(0, 0, 255, 0.5))',
      'background-color': '#FF0000'
    })
    expect(style([solid(1, 1, 1), gradient('GRADIENT_LINEAR')])).toMatchObject({
      'background-image': 'linear-gradient(90deg, #FF0000 0%, #0000FF 100%)',
      'background-color': '#FFFFFF'
    })
    const single = style([solid(1, 0, 0)])
    expect(single?.['background-color']).toBe('#FF0000')
    expect(single?.['background-image']).toBeUndefined()
  })

  test('puts a linear gradient’s stops where the canvas draws them on CSS’s gradient line', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const stops = [
      { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } }
    ]
    const style = (gradientTransform: Fill['gradientTransform']) => {
      const fill: Fill = {
        type: 'GRADIENT_LINEAR',
        color: { r: 0, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        gradientTransform,
        gradientStops: stops
      }
      const node = graph.createNode('RECTANGLE', page.id, {
        width: 200,
        height: 100,
        fills: [fill]
      })
      return element(sceneNodeToDesignDocument(graph, node.id).children[0]).inlineStyle?.[
        'background-image'
      ]
    }
    // Handles across the middle half of the box: the colours change across that half only.
    expect(style({ m00: 2, m01: 0, m02: -0.5, m10: 0, m11: 1, m12: 0 })).toBe(
      'linear-gradient(90deg, #FF0000 25%, #0000FF 75%)'
    )
    // Handles from corner to corner of a wide box run the whole CSS line.
    expect(style({ m00: 0.5, m01: 0.5, m02: 0, m10: -0.5, m11: 0.5, m12: 0.5 })).toBe(
      'linear-gradient(116.565deg, #FF0000 0%, #0000FF 100%)'
    )
  })

  test('blends each stacked fill as the canvas does', () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    const solid = (r: number, g: number, b: number, blendMode?: Fill['blendMode']): Fill => ({
      type: 'SOLID',
      color: { r, g, b, a: 1 },
      opacity: 1,
      visible: true,
      blendMode
    })
    const node = graph.createNode('RECTANGLE', page.id, {
      width: 40,
      height: 20,
      fills: [solid(1, 1, 0), solid(0, 1, 1, 'MULTIPLY'), solid(1, 0, 1)]
    })
    expect(
      element(sceneNodeToDesignDocument(graph, node.id).children[0]).inlineStyle
    ).toMatchObject({
      'background-image': 'linear-gradient(#FF00FF, #FF00FF), linear-gradient(#00FFFF, #00FFFF)',
      'background-blend-mode': 'normal, multiply',
      'background-color': '#FFFF00'
    })
  })
})
