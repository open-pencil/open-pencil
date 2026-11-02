import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { FigmaAPI } from '#core/figma-api'

function api() {
  const graph = new SceneGraph()
  return { graph, figma: new FigmaAPI(graph) }
}

// Measured with the same scripts in Figma's plugin API.
describe('a polygon or star point count', () => {
  test('reshapes the layer', () => {
    const { graph, figma } = api()
    const polygon = figma.createPolygon()
    expect(polygon.pointCount).toBe(3)
    polygon.pointCount = 6
    expect(polygon.pointCount).toBe(6)
    expect(graph.getNode(polygon.id)?.pointCount).toBe(6)
    const star = figma.createStar()
    expect(star.pointCount).toBe(5)
  })

  test('stops at 60 points', () => {
    const polygon = api().figma.createPolygon()
    polygon.pointCount = 1000
    expect(polygon.pointCount).toBe(60)
  })

  test('takes only whole numbers of at least 3', () => {
    const polygon = api().figma.createPolygon()
    const message = (problem: string) =>
      `in set_pointCount: Property "pointCount" failed validation: ${problem}`
    expect(() => (polygon.pointCount = 2)).toThrow(message('Too small: expected number to be >=3'))
    expect(() => (polygon.pointCount = 3.6)).toThrow(message('Expected int, received number'))
    expect(() => (polygon.pointCount = Number.NaN)).toThrow(
      message('Expected number, received NaN')
    )
    expect(polygon.pointCount).toBe(3)
  })
})

describe('a star inner radius', () => {
  test('sets how deep the star cuts in, between 0 and 1', () => {
    const { graph, figma } = api()
    const star = figma.createStar()
    star.innerRadius = 0.25
    expect(star.innerRadius).toBe(0.25)
    expect(graph.getNode(star.id)?.starInnerRadius).toBe(0.25)
    const message = (problem: string) =>
      `in set_innerRadius: Property "innerRadius" failed validation: ${problem}`
    expect(() => (star.innerRadius = -0.5)).toThrow(message('Too small: expected number to be >=0'))
    expect(() => (star.innerRadius = 1.5)).toThrow(message('Too big: expected number to be <=1'))
    expect(() => (star.innerRadius = Number.NaN)).toThrow(message('Expected number, received NaN'))
  })
})

describe('an ellipse arc', () => {
  test('reads a whole turn on a whole ellipse', () => {
    const arc = api().figma.createEllipse().arcData
    expect(arc.startingAngle).toBe(0)
    expect(arc.endingAngle).toBeCloseTo(2 * Math.PI, 6)
    expect(arc.innerRadius).toBe(0)
  })

  test('cuts the ellipse to an arc, keeping angles past a turn or below zero', () => {
    const { graph, figma } = api()
    const ellipse = figma.createEllipse()
    ellipse.arcData = { startingAngle: 1, endingAngle: 7, innerRadius: 0.5 }
    expect(ellipse.arcData).toEqual({ startingAngle: 1, endingAngle: 7, innerRadius: 0.5 })
    expect(graph.getNode(ellipse.id)?.arcData).toEqual({
      startingAngle: 1,
      endingAngle: 7,
      innerRadius: 0.5
    })
    ellipse.arcData = { startingAngle: -1, endingAngle: -4, innerRadius: 0 }
    expect(ellipse.arcData.endingAngle).toBe(-4)
  })

  test('gives a frozen copy', () => {
    const ellipse = api().figma.createEllipse()
    const arc = ellipse.arcData
    expect(Object.isFrozen(arc)).toBe(true)
  })

  test('lists every missing or invalid field', () => {
    const ellipse = api().figma.createEllipse()
    const message = (problem: string) =>
      `in set_arcData: Property "arcData" failed validation: ${problem}`
    expect(() => (ellipse.arcData = { startingAngle: 0 } as never)).toThrow(
      message('Required value missing at .endingAngle\nRequired value missing at .innerRadius')
    )
    expect(() => (ellipse.arcData = { startingAngle: 0, endingAngle: 3, innerRadius: 2 })).toThrow(
      message('Too big: expected number to be <=1 at .innerRadius')
    )
    expect(() => (ellipse.arcData = null as never)).toThrow(
      message('Expected object, received null')
    )
  })
})

describe('shape members on other layers', () => {
  test('exist only on the layers Figma gives them to', () => {
    const { figma } = api()
    const rectangle = figma.createRectangle()
    expect('pointCount' in rectangle).toBe(false)
    expect('arcData' in rectangle).toBe(false)
    expect('arcData' in figma.createStar()).toBe(false)
    expect('innerRadius' in figma.createPolygon()).toBe(false)
  })
})
