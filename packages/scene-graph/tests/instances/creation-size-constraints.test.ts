// #2349: an instance created at a size other than its component's kept every layer at the
// component's size and place, while resizing the same instance to that size scaled them. These
// cases create the instance as the viewport and the MCP server do, then read the copy's box and
// its path, which the issue's case B saw disagree.

import { expect, test } from 'bun:test'

import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'
import { geometryBlobBounds } from '@open-pencil/scene-graph/geometry'

/** A square outline from (0, 0) to (`size`, `size`), as Figma stores a path. */
function square(size: number): Uint8Array {
  const blob = new Uint8Array(1 + 8 + 1 + 8 + 1 + 8 + 1)
  const view = new DataView(blob.buffer)
  let offset = 0
  const command = (code: number, ...points: number[]) => {
    blob[offset++] = code
    for (const value of points) {
      view.setFloat32(offset, value, true)
      offset += 4
    }
  }
  command(1, 0, 0)
  command(2, size, 0)
  command(2, size, size)
  command(0)
  return blob
}

const SCALES = { horizontalConstraint: 'SCALE', verticalConstraint: 'SCALE' } as const
const HUGS_ITS_CORNER = { horizontalConstraint: 'MIN', verticalConstraint: 'MIN' } as const

/** A 100×100 component holding a 100×100 vector, under the constraints given. */
function xbox(
  constraints: Pick<SceneNode, 'horizontalConstraint' | 'verticalConstraint'> = SCALES
): { graph: SceneGraph; component: SceneNode } {
  const graph = new SceneGraph()
  const page = graph.getPages()[0].id
  const component = graph.createNode('COMPONENT', page, { name: 'XBox', width: 100, height: 100 })
  graph.createNode('VECTOR', component.id, {
    name: 'Art',
    width: 100,
    height: 100,
    ...constraints,
    fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: square(100) }]
  })
  return { graph, component }
}

function onlyChild(graph: SceneGraph, parent: SceneNode): SceneNode {
  const [child] = graph.getChildren(parent.id)
  if (!child) throw new Error('no copy')
  return child
}

function createAt(
  graph: SceneGraph,
  component: SceneNode,
  size: { width: number; height: number }
): SceneNode {
  const instance = graph.createInstance(component.id, graph.getPages()[0].id, size)
  if (!instance) throw new Error('no instance')
  return instance
}

test('an instance created at another size scales its scaling vector children', () => {
  const { graph, component } = xbox()
  const copy = onlyChild(graph, createAt(graph, component, { width: 300, height: 150 }))

  expect(copy.width).toBe(300)
  expect(copy.height).toBe(150)
  expect(geometryBlobBounds(copy.fillGeometry)).toEqual({ x: 0, y: 0, width: 300, height: 150 })
})

test('shrinking at creation scales the copy down too', () => {
  const { graph, component } = xbox()
  const copy = onlyChild(graph, createAt(graph, component, { width: 50, height: 25 }))

  expect(geometryBlobBounds(copy.fillGeometry)).toEqual({ x: 0, y: 0, width: 50, height: 25 })
})

test("a copy's path reaches the size the instance was created at", () => {
  const { graph, component } = xbox()
  const instance = createAt(graph, component, { width: 300, height: 150 })
  const copy = onlyChild(graph, instance)

  // Before the fix the path still spanned the component's 0–100 while the instance was 300×150.
  expect(geometryBlobBounds(copy.fillGeometry)).toEqual({
    x: 0,
    y: 0,
    width: instance.width,
    height: instance.height
  })
})

test('a copy placed by its constraints carries no overrides', () => {
  const { graph, component } = xbox()
  const instance = createAt(graph, component, { width: 300, height: 150 })

  expect([...instance.instanceOverrides.self.keys()]).toEqual([])
  expect(instance.instanceOverrides.descendants.size).toBe(0)
  expect(onlyChild(graph, instance).instanceOverrides.descendants.size).toBe(0)
})

test('a layer whose constraints do not scale keeps its size and place', () => {
  const { graph, component } = xbox(HUGS_ITS_CORNER)
  const copy = onlyChild(graph, createAt(graph, component, { width: 300, height: 150 }))

  expect(copy.width).toBe(100)
  expect(copy.height).toBe(100)
  expect(copy.x).toBe(0)
  expect(copy.y).toBe(0)
})

test('the component keeps the geometry its copies started from', () => {
  const { graph, component } = xbox()
  createAt(graph, component, { width: 300, height: 150 })
  const art = graph.getChildren(component.id)[0]

  expect(art.width).toBe(100)
  expect(geometryBlobBounds(art.fillGeometry)).toEqual({ x: 0, y: 0, width: 100, height: 100 })
})

test('an instance created at the component size keeps its copy as cloning wrote it', () => {
  const { graph, component } = xbox(HUGS_ITS_CORNER)
  const copy = onlyChild(graph, createAt(graph, component, { width: 100, height: 100 }))

  expect(copy.width).toBe(100)
  expect(copy.height).toBe(100)
  expect(geometryBlobBounds(copy.fillGeometry)).toEqual({ x: 0, y: 0, width: 100, height: 100 })
})
