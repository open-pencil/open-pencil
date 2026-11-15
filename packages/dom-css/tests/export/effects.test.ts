import { describe, expect, test } from 'bun:test'

import { sceneNodeToDesignDocument } from '@open-pencil/dom-css/export'
import { SceneGraph, type Effect, type SceneNode } from '@open-pencil/scene-graph'

// The canvas draws every Figma blur as a Gaussian of 0.43 × radius. CSS's `blur()` takes that
// sigma, and a shadow's blur length is twice it.

function effect(type: Effect['type'], radius: number, props: Partial<Effect> = {}): Effect {
  return {
    type,
    radius,
    spread: 0,
    offset: { x: 0, y: 0 },
    color: { r: 0, g: 0, b: 0, a: 0.5 },
    visible: true,
    blendMode: 'NORMAL',
    ...props
  }
}

function style(type: SceneNode['type'], effects: Effect[]) {
  const graph = new SceneGraph()
  const node = graph.createNode(type, graph.getPages()[0].id, {
    width: 40,
    height: 20,
    text: 'Hi',
    effects
  })
  const [element] = sceneNodeToDesignDocument(graph, node.id).children
  if (element?.type !== 'element') throw new Error('Expected an element')
  return element.inlineStyle
}

describe('effects in HTML export', () => {
  test('scale a bound blur radius in calc(), since its token holds the Figma radius', () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Tokens')
    const blur = graph.createVariable('blur/md', 'FLOAT', collection.id, 10)
    const soft = graph.createVariable('shadow/soft', 'FLOAT', collection.id, 10)
    const node = graph.createNode('RECTANGLE', graph.getPages()[0].id, {
      effects: [effect('LAYER_BLUR', 10), effect('DROP_SHADOW', 10)]
    })
    graph.bindVariable(node.id, 'effects/0/radius', blur.id)
    graph.bindVariable(node.id, 'effects/1/radius', soft.id)
    const [element] = sceneNodeToDesignDocument(graph, node.id).children
    if (element?.type !== 'element') throw new Error('Expected an element')
    // Each effect reads its own binding.
    expect(element.inlineStyle?.filter).toBe('blur(calc(var(--blur-md) * 0.43))')
    expect(element.inlineStyle?.['box-shadow']).toContain('calc(var(--shadow-soft) * 0.86)')
  })

  test('blur by the first layer blur and every background blur, as the canvas draws them', () => {
    const blurs = style('RECTANGLE', [
      // Hidden blurs are neither the first layer blur nor among the background blurs.
      effect('LAYER_BLUR', 30, { visible: false }),
      effect('BACKGROUND_BLUR', 30, { visible: false }),
      effect('LAYER_BLUR', 10),
      effect('LAYER_BLUR', 20),
      effect('BACKGROUND_BLUR', 10),
      effect('BACKGROUND_BLUR', 20)
    ])
    expect(blurs?.filter).toBe('blur(4.3px)')
    expect(blurs?.['backdrop-filter']).toBe('blur(4.3px) blur(8.6px)')
  })

  test('blur as the canvas blurs, by the sigma CSS takes', () => {
    expect(style('RECTANGLE', [effect('LAYER_BLUR', 10)])?.filter).toBe('blur(4.3px)')
    expect(style('RECTANGLE', [effect('BACKGROUND_BLUR', 10)])?.['backdrop-filter']).toBe(
      'blur(4.3px)'
    )
  })

  test('write a shadow’s blur length as twice that sigma', () => {
    const shadows = [
      effect('DROP_SHADOW', 10, { offset: { x: 1, y: 2 }, spread: 3 }),
      effect('INNER_SHADOW', 5)
    ]
    expect(style('RECTANGLE', shadows)?.['box-shadow']).toBe(
      '1px 2px 8.6px 3px rgba(0, 0, 0, 0.5), inset 0px 0px 4.3px 0px rgba(0, 0, 0, 0.5)'
    )
  })

  test('shadow text’s glyphs with every drop shadow, without the spread text-shadow lacks', () => {
    const text = style('TEXT', [
      effect('DROP_SHADOW', 4, { offset: { x: 1, y: 2 }, spread: 2 }),
      effect('DROP_SHADOW', 4, { offset: { x: -1, y: 2 } }),
      effect('INNER_SHADOW', 4),
      effect('DROP_SHADOW', 4, { visible: false, offset: { x: 3, y: 3 } }),
      effect('LAYER_BLUR', 10),
      effect('BACKGROUND_BLUR', 20)
    ])
    expect(text?.['text-shadow']).toBe(
      '1px 2px 3.44px rgba(0, 0, 0, 0.5), -1px 2px 3.44px rgba(0, 0, 0, 0.5)'
    )
    expect(text?.filter).toBe('blur(4.3px)')
    expect(text?.['backdrop-filter']).toBe('blur(8.6px)')
    expect(text?.['box-shadow']).toBeUndefined()
  })
})
