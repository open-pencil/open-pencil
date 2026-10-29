import { describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

async function render(jsx: string) {
  const graph = new SceneGraph()
  const [node] = await renderJSX(graph, jsx)
  return { graph, node: getNodeOrThrow(graph, node.id) }
}

describe('ellipse arcs', () => {
  test('take their angles in degrees, clockwise from three o’clock, and their hole as a share', async () => {
    const { node } = await render(
      '<Ellipse w={100} h={100} startAngle={90} endAngle={360} innerRadius={0.5} />'
    )
    expect(node.arcData).toEqual({
      startingAngle: Math.PI / 2,
      endingAngle: Math.PI * 2,
      innerRadius: 0.5
    })
  })

  test('end a whole turn from their start unless told otherwise', async () => {
    const { node } = await render('<Ellipse w={100} h={100} innerRadius={0.25} />')
    expect(node.arcData).toEqual({ startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: 0.25 })
  })

  test("are a hole on an ellipse but a star's depth on a star", async () => {
    const { node: ellipse } = await render('<Ellipse w={100} h={100} innerRadius={0.5} />')
    const { node: star } = await render('<Star w={100} h={100} innerRadius={0.5} />')
    expect(ellipse.starInnerRadius).not.toBe(0.5)
    expect(star.starInnerRadius).toBe(0.5)
    expect(star.arcData).toBeNull()
  })

  test('export only what differs from a whole ellipse', async () => {
    const { graph, node: whole } = await render('<Ellipse w={100} h={100} />')
    expect(sceneNodeToJSX(whole.id, graph)).not.toMatch(/Angle|innerRadius/)
    const { graph: arcGraph, node: arc } = await render(
      '<Ellipse w={100} h={100} startAngle={45} endAngle={225} />'
    )
    const jsx = sceneNodeToJSX(arc.id, arcGraph)
    expect(jsx).toContain('startAngle={45}')
    expect(jsx).toContain('endAngle={225}')
    expect(jsx).not.toContain('innerRadius')
  })
})

describe('flips', () => {
  test('reflect any layer, set as bare attributes or booleans', async () => {
    const { node } = await render('<Rectangle w={40} h={20} flipX rotate={30} />')
    expect(node).toMatchObject({ flipX: true, flipY: false, rotation: 30 })
    const { node: unflipped } = await render('<Rectangle w={40} h={20} flipY={false} />')
    expect(unflipped.flipY).toBe(false)
  })
})
