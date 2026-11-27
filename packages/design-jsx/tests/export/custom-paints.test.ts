import { describe, expect, test } from 'bun:test'

import { sceneNodeToJSX } from '#design-jsx/index'

import type { Fill } from '@open-pencil/scene-graph'

import { createPlainRenderer } from '../renderer'
import { makeGraph, pageId } from './helpers'

const SHADER: Fill = {
  type: 'CUSTOM',
  color: { r: 0, g: 0, b: 0, a: 1 },
  opacity: 0.5,
  visible: true,
  customEffectAssetRef: { key: 'abc', version: 'v1' },
  componentPropAssignments: [{ varValue: { value: { floatValue: 0.25 } } }]
}

describe('Figma shader paints in design JSX', () => {
  test('a shader fill and a shader stroke both come back from their JSX', async () => {
    const graph = makeGraph()
    const node = graph.createNode('RECTANGLE', pageId(graph), {
      name: 'Plate',
      width: 40,
      height: 40,
      fills: [SHADER],
      strokes: [{ ...SHADER, weight: 3, align: 'INSIDE' }]
    })
    const jsx = sceneNodeToJSX(node.id, graph)

    const reimported = makeGraph()
    const [result] = await createPlainRenderer().renderJSX(reimported, jsx)
    const copy = reimported.getNode(result.id)

    const shaderFields = {
      type: 'CUSTOM',
      customEffectAssetRef: SHADER.customEffectAssetRef,
      componentPropAssignments: SHADER.componentPropAssignments
    }
    expect(copy?.fills[0]).toMatchObject(shaderFields)
    expect(copy?.strokes[0]).toMatchObject({ ...shaderFields, weight: 3, align: 'INSIDE' })
  })
})
