import { describe, expect, test } from 'bun:test'

import {
  sceneNodeToDesignDocument,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css/export'
import { SceneGraph } from '@open-pencil/scene-graph'

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
})
