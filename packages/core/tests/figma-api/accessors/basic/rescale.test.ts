import { beforeAll, describe, expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'
import { registerTestFont, solidFill } from '#core-tests/helpers/figma-api'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'


beforeAll(() => registerTestFont())

function setup() {
  const graph = new SceneGraph()
  return { graph, api: new FigmaAPI(graph) }
}

describe('rescale', () => {
  test('rescale scales geometry, visual properties, and descendants from the root top-left', () => {
    const { api, graph } = setup()
    const frame: FigmaNodeProxy = api.createFrame()
    frame.x = 30
    frame.y = 40
    frame.resize(100, 80)
    frame.paddingLeft = 10
    frame.paddingRight = 12
    frame.paddingTop = 6
    frame.paddingBottom = 8
    frame.itemSpacing = 5
    frame.cornerRadius = 7
    frame.strokes = [solidFill({ r: 0, g: 0, b: 0, a: 1 })]
    frame.strokeWeight = 3
    frame.strokeAlign = 'CENTER'
    frame.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 1 },
        offset: { x: 5, y: -3 },
        radius: 2,
        spread: 1,
        visible: true,
        blendMode: 'NORMAL'
      }
    ]

    const text: FigmaNodeProxy = api.createText()
    text.characters = 'Hi'
    text.fontSize = 10
    text.letterSpacing = { unit: 'PIXELS', value: 2 }
    text.lineHeight = { unit: 'PIXELS', value: 14 }
    frame.appendChild(text)
    text.x = 11
    text.y = 13
    const textWidth = graph.getNode(text.id)?.width ?? 0
    expect(textWidth).toBeGreaterThan(0)

    frame.rescale(2)

    expect(frame.x).toBe(30)
    expect(frame.y).toBe(40)
    expect(frame.width).toBe(200)
    expect(frame.height).toBe(160)
    expect(frame.paddingLeft).toBe(20)
    expect(frame.paddingRight).toBe(24)
    expect(frame.paddingTop).toBe(12)
    expect(frame.paddingBottom).toBe(16)
    expect(frame.itemSpacing).toBe(10)
    expect(frame.cornerRadius).toBe(14)
    expect(frame.strokeWeight).toBe(6)
    const shadow = frame.effects[0]
    if (shadow?.type !== 'DROP_SHADOW') throw new Error('expected a scaled drop shadow')
    expect(shadow.offset).toEqual({ x: 10, y: -6 })
    expect(shadow.radius).toBe(4)
    expect(shadow.spread).toBe(2)
    expect(text.x).toBe(22)
    expect(text.y).toBe(26)
    expect(text.fontSize).toBe(20)
    expect(text.letterSpacing).toEqual({ unit: 'PIXELS', value: 4 })
    expect(text.lineHeight).toEqual({ unit: 'PIXELS', value: 28 })
    expect(graph.getNode(text.id)?.width).toBe(textWidth * 2)
  })

  test('rescale rejects occurrence descendants without mutation but permits definition children', () => {
    const { api, graph } = setup()
    const page = graph.getPages()[0]
    const inner = graph.createNode('COMPONENT', page.id)
    graph.createNode('RECTANGLE', inner.id, { width: 20, height: 10 })
    const outer = graph.createNode('COMPONENT', page.id)
    const definition = graph.createInstance(inner.id, outer.id)
    if (!definition) throw new Error('Missing definition instance')
    expectDefined(api.getNodeById(definition.id)).rescale(2)
    expect(graph.getChildren(definition.id)[0].width).toBe(40)
    const owner = graph.createInstance(outer.id, page.id)
    if (!owner) throw new Error('Missing placed owner')
    const nested = graph.getChildren(owner.id)[0]
    const rectangle = graph.getChildren(nested.id)[0]
    for (const target of [nested, rectangle]) {
      const before = structuredClone(target)
      expect(() => expectDefined(api.getNodeById(target.id)).rescale(1)).toThrow(
        'cannot be overridden in an instance: size'
      )
      expect(target).toEqual(before)
    }
  })

  test('rescale rejects non-Figma scale factors and pages', () => {
    const { api } = setup()
    const rect = api.createRectangle()
    expect(() => rect.rescale(0.009)).toThrow('Scale must be at least 0.01')
    expect(() => rect.rescale(Number.POSITIVE_INFINITY)).toThrow('Scale must be a finite number')
    expect(() => api.currentPage.rescale(2)).toThrow('rescale() is not supported on this node')
    const section = api.createSection()
    expect(() => section.rescale(2)).toThrow('rescale() is not supported on this node')
  })
})
