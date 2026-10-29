import { describe, expect, test } from 'bun:test'

import { expectDefined, getNodeOrThrow } from '#core-tests/helpers/assert'
import { pick } from 'es-toolkit'

import { renderJSX } from '@open-pencil/core/design-jsx'
import { sceneNodeToJSX } from '@open-pencil/design-jsx'
import { SceneGraph } from '@open-pencil/scene-graph'
import { vectorNetworkPaths } from '@open-pencil/scene-graph/vector-network'

async function render(jsx: string) {
  const graph = new SceneGraph()
  const [node] = await renderJSX(graph, jsx)
  return getNodeOrThrow(graph, node.id)
}

describe('<Vector> paths', () => {
  test('draw a d as SVG does, the layer taking its bounds', async () => {
    const node = await render('<Vector x={10} y={20} d="M4 2 L20 2 L12 18 Z" bg="#000" />')
    expect(node).toMatchObject({ x: 14, y: 22, width: 16, height: 16 })
    expect(vectorNetworkPaths(expectDefined(node.vectorNetwork, 'network'))).toEqual([
      { windingRule: 'NONZERO', data: 'M0 0L16 0L8 16L0 0Z' }
    ])
  })

  test('take relative commands and arcs in d, and fillRule for holes', async () => {
    const node = await render(
      '<Vector d="m0 0 h20 v20 h-20 z M5 5 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 z" fillRule="evenodd" />'
    )
    expect(node).toMatchObject({ width: 20, height: 20 })
    expect(node.vectorNetwork?.regions.map((region) => region.windingRule)).toEqual(['EVENODD'])
  })

  test('size a curve by where it reaches, not by its control points', async () => {
    const node = await render('<Vector d="M0 0 C0 40 40 40 40 0" stroke="#000" />')
    expect(node.width).toBe(40)
    expect(node.height).toBe(30)
  })

  test('take paths as Figma writes them, an open path with NONE', async () => {
    const node = await render(
      `<Vector paths={[{ windingRule: 'EVENODD', data: 'M0 0 L10 0 L10 10 Z' }, { windingRule: 'NONE', data: 'M0 20 L10 20' }]} />`
    )
    expect(vectorNetworkPaths(expectDefined(node.vectorNetwork, 'network'))).toEqual([
      { windingRule: 'EVENODD', data: 'M0 0L10 0L10 10L0 0Z' },
      { windingRule: 'NONE', data: 'M0 20L10 20' }
    ])
  })

  test('draw in the box they are given as written, as an icon in its view box', async () => {
    const node = await render('<Vector w={24} h={24} d="M4 4 L20 4 L20 20 Z" />')
    expect(node).toMatchObject({ x: 0, y: 0, width: 24, height: 24 })
    expect(node.vectorNetwork?.vertices).toEqual([
      { x: 4, y: 4 },
      { x: 20, y: 4 },
      { x: 20, y: 20 }
    ])
  })

  test('keep a size bound to a variable, drawing the path in that box', async () => {
    const graph = new SceneGraph()
    const collection = graph.createCollection('Sizes')
    graph.createVariable('Icon', 'FLOAT', collection.id, 32)
    const [created] = await renderJSX(
      graph,
      '<Vector w={designVar("Icon")} h={designVar("Icon")} d="M4 4 L20 4 L20 20 Z" />'
    )
    const node = getNodeOrThrow(graph, created.id)
    expect(node).toMatchObject({ x: 0, y: 0, width: 32, height: 32 })
    expect(node.vectorNetwork?.vertices[0]).toEqual({ x: 4, y: 4 })
  })

  test('take their size from style as from w and h', async () => {
    const node = await render(
      '<Vector style={{ width: 24, height: 24 }} d="M4 4 L20 4 L20 20 Z" />'
    )
    expect(node).toMatchObject({ x: 0, y: 0, width: 24, height: 24 })
    expect(node.vectorNetwork?.vertices[0]).toEqual({ x: 4, y: 4 })
  })

  test('fill an open path as if closed only when nothing strokes it', async () => {
    const filled = await render('<Vector d="M0 0 L20 0 L20 20" bg="#000" />')
    expect(vectorNetworkPaths(expectDefined(filled.vectorNetwork, 'network'))).toEqual([
      { windingRule: 'NONZERO', data: 'M0 0L20 0L20 20' }
    ])
    const stroked = await render('<Vector d="M0 0 L20 0 L20 20" bg="#000" stroke="#000" />')
    expect(vectorNetworkPaths(expectDefined(stroked.vectorNetwork, 'network'))).toEqual([
      { windingRule: 'NONE', data: 'M0 0L20 0L20 20' }
    ])
  })

  test('say what is wrong with a path', async () => {
    await expect(render('<Vector d="M0 0 L" />')).rejects.toThrow('Invalid <Vector> `d`')
    await expect(
      render(`<Vector paths={[{ windingRule: 'NONZERO', data: 'M0 0 h10 v10 Z' }]} />`)
    ).rejects.toThrow('Invalid <Vector> paths[0]')
    await expect(render('<Vector d="M0 0 L1 1" paths={[]} />')).rejects.toThrow('not both')
  })
})

describe('<Vector> export', () => {
  const pathsOf = (node: { vectorNetwork: Parameters<typeof vectorNetworkPaths>[0] | null }) =>
    vectorNetworkPaths(expectDefined(node.vectorNetwork, 'network'))

  test('writes the paths a vector draws, which render back to the same layer', async () => {
    const graph = new SceneGraph()
    const [source] = await renderJSX(
      graph,
      `<Vector x={8} y={4} w={24} h={24} bg="#E22" paths={[{ windingRule: 'EVENODD', data: 'M4 4L20 4L20 20L4 20L4 4ZM8 8L16 8L16 16L8 16L8 8Z' }, { windingRule: 'NONE', data: 'M0 22L24 22' }]} />`
    )
    const jsx = sceneNodeToJSX(source.id, graph)
    expect(jsx).toContain('paths={[')
    const [result] = await renderJSX(graph, jsx)
    const before = getNodeOrThrow(graph, source.id)
    const after = getNodeOrThrow(graph, result.id)
    expect(pick(after, ['x', 'y', 'width', 'height'])).toEqual(
      pick(before, ['x', 'y', 'width', 'height'])
    )
    expect(pathsOf(after)).toEqual(pathsOf(before))
    expect(sceneNodeToJSX(result.id, graph)).toBe(jsx)
  })

  test('keeps inline SVG artwork drawing after a round trip', async () => {
    const graph = new SceneGraph()
    const [source] = await renderJSX(
      graph,
      '<svg viewBox="0 0 24 24" size={24}><path d="M12 2 L22 22 L2 22 Z" fill="#000" /></svg>'
    )
    const [result] = await renderJSX(graph, sceneNodeToJSX(source.id, graph))
    const vectors = (id: string) => graph.getChildren(id).filter((child) => child.type === 'VECTOR')
    expect(vectors(result.id).map(pathsOf)).toEqual(vectors(source.id).map(pathsOf))
    expect(vectors(result.id)).toHaveLength(1)
    expect(pathsOf(vectors(result.id)[0])).toEqual([
      { windingRule: 'NONZERO', data: 'M12 2L22 22L2 22L12 2Z' }
    ])
  })
})
