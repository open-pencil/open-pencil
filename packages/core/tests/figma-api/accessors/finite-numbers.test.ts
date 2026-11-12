import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'
import type { FigmaTransform } from '#core/figma-api/types'

// Messages measured with the same assignments in Figma desktop 126's plugin API.
const message = (property: string, value: number, method = `set_${property}`) =>
  `in ${method}: Property "${property}" failed validation: Expected number, received ${value}`

function stroked() {
  const graph = new SceneGraph()
  const frame = new FigmaAPI(graph).createFrame()
  frame.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
  frame.layoutMode = 'HORIZONTAL'
  return { graph, frame }
}

const PROPERTIES = [
  'x',
  'y',
  'rotation',
  'opacity',
  'strokeWeight',
  'strokeTopWeight',
  'strokeRightWeight',
  'strokeBottomWeight',
  'strokeLeftWeight',
  'strokeMiterLimit',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'cornerSmoothing',
  'itemSpacing',
  'counterAxisSpacing',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight'
] as const

describe('a number a layer takes', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
    for (const property of PROPERTIES) {
      test(`refuses ${value} for ${property} and keeps the layer as it was`, () => {
        const { graph, frame } = stroked()
        const before = JSON.stringify(graph.getNode(frame.id))
        expect(() => Reflect.set(frame, property, value)).toThrow(message(property, value))
        expect(JSON.stringify(graph.getNode(frame.id))).toBe(before)
      })
    }

    test(`refuses ${value} in a dash pattern, a transform, and a scale`, () => {
      const { frame } = stroked()
      expect(() => (frame.dashPattern = [4, value])).toThrow(
        `in set_dashPattern: Property "dashPattern" failed validation: Expected number, received ${value} at index 1`
      )
      expect(
        () =>
          (frame.relativeTransform = [
            [1, 0, value],
            [0, 1, 0]
          ])
      ).toThrow(`Expected number, received ${value} at [0][2]`)
      expect(() => frame.rescale(value)).toThrow(message('scale', value, 'rescale'))
    })
  }

  test('grows to fill auto layout only with 0 or 1', () => {
    const { frame } = stroked()
    frame.layoutGrow = 1
    expect(frame.layoutGrow).toBe(1)
    expect(() => (frame.layoutGrow = 0.5)).toThrow(
      'in set_layoutGrow: Property "layoutGrow" failed validation: Expected one of the following, but none matched:\n' +
        '  Invalid input: expected 0\n' +
        '  Invalid input: expected 1'
    )
  })

  test('takes a transform row as an object keyed by index, and clears a size limit with null', () => {
    const { frame } = stroked()
    frame.relativeTransform = [{ 0: 1, 1: 0, 2: 7 }, [0, 1, 3]] as unknown as FigmaTransform
    expect(frame.relativeTransform).toEqual([
      [1, 0, 7],
      [0, 1, 3]
    ])
    frame.minWidth = 10
    frame.minWidth = null
    expect(frame.minWidth).toBeNull()
  })
})
