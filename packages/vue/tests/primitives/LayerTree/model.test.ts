import { describe, expect, test } from 'bun:test'
import { reactive } from 'vue'
import { createShapeWithText } from '@open-pencil/scene-graph/generated'
import { SceneGraph } from '@open-pencil/scene-graph'
import { withIcon } from '@open-pencil/scene-graph/icons'
import { colorToFill } from '@open-pencil/scene-graph/color'
import { buildLayerTreeModel, patchLayerNode, layerSelectionForTarget, visibleLayerRows } from '@open-pencil/vue/primitives/LayerTree'
import { dropIndex } from '#vue/primitives/LayerTree/model'
import { createRect, firstPageId, makeSceneGraph } from '@open-pencil/test-support/scene'

describe('layer tree model', () => {
  test('marks icon frames, so rows can show them as icons', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, { name: 'Frame' })
    const icon = graph.createNode('FRAME', pageId, { name: 'cat' })
    graph.updateNode(icon.id, { pluginData: withIcon(icon, { name: 'mdi:cat' }) })

    const model = buildLayerTreeModel(graph, pageId)
    expect(model.byId.get(icon.id)?.icon).toBe(true)
    expect(model.byId.get(frame.id)?.icon).toBe(false)

    const row = model.byId.get(frame.id)
    if (!row) throw new Error('Expected the frame in the model')
    graph.updateNode(frame.id, { pluginData: withIcon(frame, { name: 'mdi:home' }) })
    expect(patchLayerNode(row, frame)).toBe(true)
    expect(row.icon).toBe(true)
  })

  test('carries the variable modes set on a layer itself, so rows can tag them', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const theme = graph.createCollection('Theme')
    const dark = graph.createMode(theme.id, 'Dark') ?? ''
    const frame = graph.createNode('FRAME', pageId, { name: 'Frame' })

    const model = buildLayerTreeModel(graph, pageId)
    const row = model.byId.get(frame.id)
    if (!row) throw new Error('Expected the frame in the model')
    expect(row.modeIds).toBeUndefined()

    graph.updateNode(frame.id, { variableModes: { [theme.id]: dark } })
    expect(patchLayerNode(row, frame)).toBe(true)
    expect(row.modeIds).toEqual([dark])
  })

  test("carries a shape with text's kind, so its row draws the outline", () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const shape = createShapeWithText(graph, pageId, { shapeWithTextType: 'DIAMOND' })

    const row = buildLayerTreeModel(graph, pageId).byId.get(shape.id)
    if (!row) throw new Error('Expected the shape in the model')
    expect(row.shapeWithTextType).toBe('DIAMOND')

    graph.updateNode(shape.id, { shapeWithTextType: 'ELLIPSE' })
    expect(patchLayerNode(row, shape)).toBe(true)
    expect(row.shapeWithTextType).toBe('ELLIPSE')
  })

  test("carries a shape's outline and placement, so its row draws the shape", () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const line = (x: number) => ({
      vertices: [
        { x: 0, y: 0 },
        { x, y: 10 }
      ],
      segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
      regions: []
    })
    const vector = graph.createNode('VECTOR', pageId, { vectorNetwork: line(10) })
    const rect = graph.createNode('RECTANGLE', pageId)
    const frame = graph.createNode('FRAME', pageId)

    const model = buildLayerTreeModel(graph, pageId)
    const row = model.byId.get(vector.id)
    if (!row) throw new Error('Expected the vector in the model')
    expect(row.outline?.vectorNetwork).toBe(vector.vectorNetwork)
    expect(model.byId.get(rect.id)?.outline).toMatchObject({ type: 'RECTANGLE' })
    expect(model.byId.get(frame.id)?.outline).toBeUndefined()

    // The layer tree patches its rows through their reactive proxies.
    expect(patchLayerNode(reactive(row), vector)).toBe(false)
    graph.updateNode(vector.id, { vectorNetwork: line(20) })
    expect(patchLayerNode(reactive(row), vector)).toBe(true)
    expect(row.outline?.vectorNetwork).toBe(vector.vectorNetwork)

    graph.updateNode(vector.id, { rotation: 30, flipX: true })
    expect(patchLayerNode(reactive(row), vector)).toBe(true)
    expect(row.outline).toMatchObject({ rotation: 30, flipX: true })

    const rectRow = model.byId.get(rect.id)
    if (!rectRow) throw new Error('Expected the rectangle in the model')
    graph.updateNode(rect.id, { cornerRadius: 8 })
    expect(patchLayerNode(reactive(rectRow), rect)).toBe(true)
    expect(rectRow.outline?.cornerRadius).toBe(8)
  })
})

describe('layer row order', () => {
  test('lists an auto layout in flow order and other layers front-most first, as Figma does', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const rowsOf = (layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL' | 'GRID') => {
      const frame = graph.createNode('FRAME', pageId, { layoutMode })
      const ids = ['a', 'b', 'c'].map(
        (name) => graph.createNode('RECTANGLE', frame.id, { name }).id
      )
      const rows = buildLayerTreeModel(graph, pageId).byId.get(frame.id)?.children ?? []
      return { ids, rows: rows.map((row) => row.id) }
    }
    for (const mode of ['HORIZONTAL', 'VERTICAL'] as const) {
      const { ids, rows } = rowsOf(mode)
      expect(rows).toEqual(ids)
    }
    for (const mode of ['NONE', 'GRID'] as const) {
      const { ids, rows } = rowsOf(mode)
      expect(rows).toEqual(ids.toReversed())
    }
  })
})

describe('layer marks', () => {
  test('marks a layer that masks or shows an image, whose row shows that in place of its shape', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const image = { ...colorToFill('#000000'), type: 'IMAGE' as const, imageHash: 'hash' }
    const rect = graph.createNode('RECTANGLE', pageId, { fills: [image] })
    const hidden = graph.createNode('RECTANGLE', pageId, { fills: [{ ...image, visible: false }] })
    const mask = graph.createNode('ELLIPSE', pageId, { isMask: true })

    const model = buildLayerTreeModel(graph, pageId)
    expect(model.byId.get(rect.id)).toMatchObject({ image: true, mask: false })
    expect(model.byId.get(hidden.id)?.image).toBe(false)
    expect(model.byId.get(mask.id)?.mask).toBe(true)

    const row = model.byId.get(rect.id)
    if (!row) throw new Error('Expected the rectangle in the model')
    graph.updateNode(rect.id, { fills: [] })
    expect(patchLayerNode(reactive(row), rect)).toBe(true)
    expect(row.image).toBe(false)
  })
})

describe('drop index', () => {
  test('a layer dragged down past a later sibling lands right after it', () => {
    // Dropping A below B in [A, B, C]: B's index + 1 is 2, counted without A it is 1.
    expect(dropIndex(['A', 'B', 'C'], 'A', 2)).toBe(1)
  })

  test('a layer dragged up, or from another parent, keeps the target index', () => {
    expect(dropIndex(['A', 'B', 'C'], 'C', 1)).toBe(1)
    expect(dropIndex(['A', 'B', 'C'], 'X', 2)).toBe(2)
  })
})

describe('layer tree model', () => {
  test('lists the front-most layer first, as Figma does', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const frame = graph.createNode('FRAME', pageId, { name: 'Frame' })
    const child = createRect(graph, frame.id, { name: 'Child' })
    const sibling = createRect(graph, pageId, { name: 'Sibling' })
    const internal = graph.createNode('RECTANGLE', pageId, {
      name: 'Internal style',
      internalOnly: true
    })

    const model = buildLayerTreeModel(graph, pageId)

    // The sibling was added after the frame, so it is in front of it.
    expect(model.items.map((node) => node.id)).toEqual([sibling.id, frame.id])
    expect(model.items[1]?.children?.map((node) => node.id)).toEqual([child.id])
    expect(model.byId.get(child.id)?.name).toBe('Child')
    expect(model.byId.has(internal.id)).toBe(false)
  })

  test('derives only rows made visible by expansion', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const frame = graph.createNode('FRAME', pageId, { name: 'Frame' })
    const nested = graph.createNode('FRAME', frame.id, { name: 'Nested' })
    const child = createRect(graph, nested.id, { name: 'Child' })
    const model = buildLayerTreeModel(graph, pageId)

    expect(visibleLayerRows(model.items, new Set()).map((row) => row.node.id)).toEqual([frame.id])
    expect(
      visibleLayerRows(model.items, new Set([frame.id, nested.id])).map((row) => [
        row.node.id,
        row.level
      ])
    ).toEqual([
      [frame.id, 1],
      [nested.id, 2],
      [child.id, 3]
    ])
  })

  test('patches an indexed node without replacing its identity', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const sceneNode = createRect(graph, pageId, { name: 'Before' })
    const model = buildLayerTreeModel(graph, pageId)
    const layerNode = model.byId.get(sceneNode.id)
    expect(layerNode).toBeDefined()
    if (!layerNode) return

    graph.updateNode(sceneNode.id, { name: 'After', visible: false })
    const updated = graph.getNode(sceneNode.id)
    expect(updated).toBeDefined()
    if (!updated) return

    expect(patchLayerNode(layerNode, updated)).toBe(true)
    expect(model.items[0]).toBe(layerNode)
    expect(layerNode).toMatchObject({ name: 'After', visible: false })
    expect(patchLayerNode(layerNode, updated)).toBe(false)
  })
})

describe('layer tree selection', () => {
  const rows = ['a', 'b', 'c', 'd']

  test('replaces, toggles, and ranges from the anchor', () => {
    expect(
      layerSelectionForTarget(rows, new Set(['a']), 'a', 'c', {
        additive: false,
        range: true
      })
    ).toEqual(new Set(['a', 'b', 'c']))
    expect(
      layerSelectionForTarget(rows, new Set(['a']), 'a', 'c', {
        additive: true,
        range: true
      })
    ).toEqual(new Set(['a', 'b', 'c']))
    expect(
      layerSelectionForTarget(rows, new Set(['a', 'b']), 'a', 'b', {
        additive: true,
        range: false
      })
    ).toEqual(new Set(['a']))
  })

  test('falls back to the target when the anchor is not visible', () => {
    expect(
      layerSelectionForTarget(rows, new Set(['a']), 'missing', 'd', {
        additive: true,
        range: true
      })
    ).toEqual(new Set(['d']))
  })
})
