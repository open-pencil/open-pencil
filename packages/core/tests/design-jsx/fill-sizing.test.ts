import { describe, expect, it } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { layoutSizing, SceneGraph } from '@open-pencil/scene-graph'

const makeSceneGraph = () => new SceneGraph()

const PARENTS = {
  row: 'flex="row" w={300} h={200}',
  column: 'flex="col" w={300} h={200}',
  grid: 'grid columns="1fr 1fr" rows="1fr" w={300} h={200}'
}

async function renderChild(parent: string, size: string) {
  const graph = makeSceneGraph()
  const [frame] = await renderJSX(
    graph,
    `<Frame name="Parent" ${parent}><Rectangle name="Child" ${size} bg="#000" /></Frame>`
  )
  computeAllLayouts(graph)
  const [childId] = getNodeOrThrow(graph, frame.id).childIds
  return { graph, frameId: frame.id, child: getNodeOrThrow(graph, childId) }
}

function sizing(graph: SceneGraph, id: string) {
  const node = getNodeOrThrow(graph, id)
  return [layoutSizing(graph, node, 'HORIZONTAL'), layoutSizing(graph, node, 'VERTICAL')]
}

describe('fill sizing round-trip', () => {
  for (const [parentName, parent] of Object.entries(PARENTS)) {
    for (const [size, expected] of [
      ['w="fill" h={40}', ['FILL', 'FIXED']],
      ['w={40} h="fill"', ['FIXED', 'FILL']],
      ['w="fill" h="fill"', ['FILL', 'FILL']]
    ] as const) {
      it(`${size} in a ${parentName} fills only that axis and exports it`, async () => {
        const { graph, frameId, child } = await renderChild(parent, size)
        expect(sizing(graph, child.id)).toEqual([...expected])
        expect(child.width).toBe(expected[0] === 'FILL' ? (parentName === 'grid' ? 150 : 300) : 40)
        expect(child.height).toBe(expected[1] === 'FILL' ? 200 : 40)

        const exported = sceneNodeToJSX(frameId, graph)
        const again = makeSceneGraph()
        const [frame] = await renderJSX(again, exported)
        computeAllLayouts(again)
        const [copyId] = getNodeOrThrow(again, frame.id).childIds
        expect(sizing(again, copyId)).toEqual([...expected])
        const copy = getNodeOrThrow(again, copyId)
        expect([copy.width, copy.height]).toEqual([child.width, child.height])
      })
    }
  }
})
