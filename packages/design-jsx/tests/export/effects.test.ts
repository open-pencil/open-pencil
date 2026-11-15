import { describe, expect, test } from 'bun:test'

import { backgroundBlur, glass, sceneNodeToJSX } from '#design-jsx/index'

import { makeGraph, pageId } from './helpers'

describe('sceneNodeToJSX effects', () => {
  test('effects: shadow and blur', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      width: 100,
      height: 100,
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0,
          visible: true
        },
        {
          type: 'LAYER_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 4,
          spread: 0,
          visible: true
        }
      ]
    })
    const jsx = sceneNodeToJSX(node.id, graph)
    expect(jsx).toContain('shadow="0 4 8')
    expect(jsx).toContain('blur={4}')
  })

  test('effects: two shadows become one effects prop, not duplicate attributes', () => {
    const graph = makeGraph()
    const shadow = {
      type: 'DROP_SHADOW' as const,
      color: { r: 0, g: 0, b: 0, a: 0.2 },
      offset: { x: 0, y: 2 },
      radius: 4,
      spread: 0,
      visible: true
    }
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Card',
      width: 10,
      height: 10,
      effects: [shadow, { ...shadow, offset: { x: 0, y: 8 }, radius: 16 }]
    })
    expect(sceneNodeToJSX(node.id, graph)).toBe(
      [
        '<Rectangle name="Card" w={10} h={10} effects={[',
        '  dropShadow({ x: 0, y: 2, radius: 4, color: "#00000033" }),',
        '  dropShadow({ x: 0, y: 8, radius: 16, color: "#00000033" })',
        ']} />'
      ].join('\n')
    )
  })

  test('effects: a background blur is not exported as a layer blur', () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Glass',
      width: 10,
      height: 10,
      effects: [
        {
          type: 'BACKGROUND_BLUR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          offset: { x: 0, y: 0 },
          radius: 12,
          spread: 0,
          visible: true
        }
      ]
    })
    expect(sceneNodeToJSX(node.id, graph)).toBe(
      '<Rectangle name="Glass" w={10} h={10} effects={[backgroundBlur(12)]} />'
    )
  })

  test('effects: a progressive blur exports as the call that builds it', () => {
    const graph = makeGraph()
    const effect = backgroundBlur({ radius: 20, startRadius: 2 })
    expect(effect.progressive).toEqual({
      startRadius: 2,
      startOffset: { x: 0.5, y: 0 },
      endOffset: { x: 0.5, y: 1 }
    })
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Fade',
      width: 10,
      height: 10,
      effects: [effect]
    })
    expect(sceneNodeToJSX(node.id, graph)).toBe(
      [
        '<Rectangle name="Fade" w={10} h={10} effects={[',
        '  backgroundBlur({',
        '    radius: 20,',
        '    startRadius: 2,',
        '    startOffset: { x: 0.5, y: 0 },',
        '    endOffset: { x: 0.5, y: 1 }',
        '  })',
        ']} />'
      ].join('\n')
    )
  })

  test('effects: a glass effect exports as the glass() call that builds it', () => {
    const graph = makeGraph()
    const effect = glass({ refraction: 0.8, depth: 30, lightAngle: 15, radius: 2, visible: false })
    expect(effect.glass).toEqual({
      refraction: 0.8,
      depth: 30,
      lightAngle: 15,
      lightIntensity: 0.5,
      dispersion: 0
    })
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Lens',
      width: 10,
      height: 10,
      effects: [effect]
    })
    expect(sceneNodeToJSX(node.id, graph)).toBe(
      [
        '<Rectangle name="Lens" w={10} h={10} effects={[',
        '  glass({',
        '    refraction: 0.8,',
        '    depth: 30,',
        '    lightAngle: 15,',
        '    lightIntensity: 0.5,',
        '    dispersion: 0,',
        '    radius: 2,',
        '    visible: false',
        '  })',
        ']} />'
      ].join('\n')
    )
  })
})
