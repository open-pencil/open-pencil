import { beforeAll, describe, expect, test } from 'bun:test'

import { registerTestFont } from '#core-tests/helpers/figma-api'

import { FigmaAPI, type FigmaNodeProxy } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'
import { hasInstanceOverride } from '@open-pencil/scene-graph/instances'

// Text edits need the text's font loaded, as in Figma; this file must not rely on another's.
beforeAll(() => registerTestFont())

// Recorded in Figma desktop 126 (2026-10-27).

const size = (node: FigmaNodeProxy) => [node.width, node.height]

describe('resize to zero', () => {
  test('resize keeps each side of any layer at 0.0001 or more', () => {
    const figma = new FigmaAPI(new SceneGraph())
    for (const create of [
      () => figma.createFrame(),
      () => figma.createRectangle(),
      () => figma.createEllipse(),
      () => figma.createStar(),
      () => figma.createComponent()
    ]) {
      const node = create()
      node.resize(0, 50)
      expect(size(node)).toEqual([0.0001, 50])
      node.resize(0, 0)
      expect(size(node)).toEqual([0.0001, 0.0001])
      node.resize(0.001, 0.00001)
      expect(size(node)).toEqual([0.001, 0.0001])
    }
  })

  test('a line keeps a height of zero, and resizeWithoutConstraints keeps any zero', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const line = figma.createLine()
    line.resize(0, 0)
    expect(size(line)).toEqual([0.0001, 0])
    line.resize(50, 0.00001)
    expect(size(line)).toEqual([50, 0.0001])
    const frame = figma.createFrame()
    frame.resizeWithoutConstraints(0, 0)
    expect(size(frame)).toEqual([0, 0])
  })

  test('a negative side or one that is not a number is refused', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const frame = figma.createFrame()
    expect(() => frame.resize(-5, 50)).toThrow(
      'in resize: Property "width" failed validation: Too small: expected number to be >=0'
    )
    expect(() => frame.resizeWithoutConstraints(5, -1)).toThrow(
      'in resizeWithoutConstraints: Property "height" failed validation: Too small: expected number to be >=0'
    )
    expect(() => frame.resize(Number.NaN, 5)).toThrow(
      'in resize: Property "width" failed validation: Expected number, received NaN'
    )
    expect(size(frame)).toEqual([100, 100])
  })
})

describe('resize inside an instance', () => {
  function instanceLayers() {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const inner = figma.createComponent()
    inner.resize(20, 20)
    const card = figma.createComponent()
    card.appendChild(inner.createInstance())
    const rectangle = figma.createRectangle()
    rectangle.resize(30, 30)
    card.appendChild(rectangle)
    const stack = figma.createComponent()
    stack.layoutMode = 'VERTICAL'
    const item = figma.createFrame()
    item.resize(40, 40)
    stack.appendChild(item)
    const layers = [
      ...(card.createInstance().children as FigmaNodeProxy[]),
      ...(stack.createInstance().children as FigmaNodeProxy[])
    ]
    return { graph, layers }
  }

  test('does nothing to a free layer, a nested instance, or an auto layout child', () => {
    const { graph, layers } = instanceLayers()
    for (const resize of ['resize', 'resizeWithoutConstraints'] as const) {
      for (const layer of layers) {
        const before = size(layer)
        layer[resize](55, 66)
        expect(size(layer)).toEqual(before)
        expect(hasInstanceOverride(graph, layer.id, 'width')).toBe(false)
      }
    }
  })

  test('still refuses a negative side', () => {
    const { layers } = instanceLayers()
    expect(() => layers[1].resize(-5, 10)).toThrow(
      'in resize: Property "width" failed validation: Too small: expected number to be >=0'
    )
  })
})

describe('resize to the size a layer has', () => {
  test('records no size override on an instance, and a new size records both sides', () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    const component = figma.createComponent()
    component.resize(40, 30)
    const instance = component.createInstance()

    instance.resize(40, 30)
    expect(hasInstanceOverride(graph, instance.id, 'width')).toBe(false)
    expect(hasInstanceOverride(graph, instance.id, 'height')).toBe(false)

    instance.resize(60, 30)
    expect(hasInstanceOverride(graph, instance.id, 'width')).toBe(true)
    expect(hasInstanceOverride(graph, instance.id, 'height')).toBe(true)
  })
})

describe('sizing after a resize', () => {
  function stack(figma: FigmaAPI) {
    const frame = figma.createFrame()
    frame.layoutMode = 'HORIZONTAL'
    frame.primaryAxisSizingMode = 'AUTO'
    frame.counterAxisSizingMode = 'AUTO'
    const item = figma.createRectangle()
    item.resize(40, 20)
    frame.appendChild(item)
    return frame
  }

  test('auto layout stops hugging only along an axis whose size changes', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const same = stack(figma)
    same.resize(same.width, same.height)
    expect([same.primaryAxisSizingMode, same.counterAxisSizingMode]).toEqual(['AUTO', 'AUTO'])
    const wider = stack(figma)
    wider.resize(60, wider.height)
    expect([wider.primaryAxisSizingMode, wider.counterAxisSizingMode]).toEqual(['FIXED', 'AUTO'])
  })

  test('a text keeps sizing itself along the sides a resize leaves alone', () => {
    const figma = new FigmaAPI(new SceneGraph())
    const after = (mode: 'WIDTH_AND_HEIGHT' | 'HEIGHT', width: number, height: number): string => {
      const text = figma.createText()
      text.characters = 'Label'
      text.textAutoResize = mode
      text.resize(text.width + width, text.height + height)
      return text.textAutoResize
    }
    expect(after('WIDTH_AND_HEIGHT', 0, 0)).toBe('WIDTH_AND_HEIGHT')
    expect(after('WIDTH_AND_HEIGHT', 20, 0)).toBe('HEIGHT')
    expect(after('WIDTH_AND_HEIGHT', 0, 10)).toBe('NONE')
    expect(after('HEIGHT', 20, 0)).toBe('HEIGHT')
    expect(after('HEIGHT', 0, 10)).toBe('NONE')
  })
})
