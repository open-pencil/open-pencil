import { expect, test } from 'bun:test'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'

test('finds an override layer among the instance children, by its name before renames', async () => {
  const graph = new SceneGraph()
  const [, created] = await renderJSX(
    graph,
    `<Component name="Card" w={60} h={24}>
       <Frame name="Card" w={4} h={4} />
       <Frame name="Icon:Small" w={4} h={4} />
       <Frame name="A" w={4} h={4} />
       <Frame name="B" w={4} h={4} />
     </Component>
     <Instance of="Card" overrides={{ 'Card:visible': false, 'Icon:Small:opacity': 0.5, 'A:name': 'B', 'B:name': 'C' }} />`
  )
  expect(graph.getNode(created.id)?.visible).toBe(true)
  const children = graph.getChildren(created.id)
  expect(children.map((child) => child.name)).toEqual(['Card', 'Icon:Small', 'B', 'C'])
  expect(children[0]?.visible).toBe(false)
  expect(children[1]?.opacity).toBe(0.5)
})

test('writes only fields an instance can override, and rejects a layer name several layers share', async () => {
  const graph = new SceneGraph()
  const [, created] = await renderJSX(
    graph,
    `<Component name="Pair" w={60} h={24}><Frame name="Dot" w={4} h={4} /><Frame name="Dot" w={4} h={4} /><Frame name="Box" w={4} h={4} /></Component>
     <Instance of="Pair" overrides={{ 'Box:childIds': ['missing'], 'Box:parentId': 'missing', 'Box:type': 'TEXT', 'Box:x': 30 }} />`
  )
  const box = graph.getChildren(created.id)[2]
  expect(box?.childIds).toEqual([])
  expect(box?.parentId).toBe(created.id)
  expect(box?.type).toBe('FRAME')
  expect(box?.x).toBe(0)
  const stored = graph.getNode(created.id)?.instanceOverrides.descendants.get(box?.id ?? '')
  for (const field of ['childIds', 'parentId', 'type', 'x']) expect(stored?.has(field)).not.toBe(true)
  await expect(
    renderJSX(graph, `<Instance of="Pair" overrides={{ 'Dot:opacity': 0.5 }} />`)
  ).rejects.toThrow('ambiguous')
})
