import { describe, expect, test } from 'bun:test'

import { compact } from 'es-toolkit/array'
import { computed, ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { MIXED, type MixedValue } from '#vue/controls/node-props/use'
import {
  DEFAULT_STROKE,
  createStrokeGeometryActions,
  createStrokeGeometryState,
  isStrokeCapValue
} from '#vue/controls/stroke/helpers'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

function strokedRect(overrides: Partial<SceneNode> = {}) {
  const graph = makeSceneGraph()
  const node = graph.createNode('RECTANGLE', firstPageId(graph), {
    strokes: [{ ...DEFAULT_STROKE }],
    ...overrides
  })
  return { graph, node }
}

function merged(nodes: SceneNode[]) {
  return <K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> => {
    const first = nodes[0]?.[key]
    if (first === undefined || nodes.some((node) => node[key] !== first)) return MIXED
    return first
  }
}

describe('stroke geometry controls', () => {
  test('is active only when every selected node has a stroke and reports mixed values', () => {
    const { node } = strokedRect()
    const other = structuredClone(node)
    other.id = 'other'
    other.strokeJoin = 'BEVEL'
    const nodes = ref([node, other])
    const state = createStrokeGeometryState({
      nodes: computed(() => nodes.value),
      merged: (key) => merged(nodes.value)(key)
    })

    expect(state.advancedActive.value).toBe(true)
    expect(state.cap.value).toBe('NONE')
    expect(state.join.value).toBe(MIXED)

    nodes.value[1].strokes = []
    expect(state.advancedActive.value).toBe(false)
  })

  test('synchronizes node and paint cap and join with one multi-selection undo', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const first = graph.createNode('RECTANGLE', pageId, { strokes: [{ ...DEFAULT_STROKE }] })
    const second = graph.createNode('RECTANGLE', pageId, { strokes: [{ ...DEFAULT_STROKE }] })
    const editor = createEditor({ graph })
    const nodes = computed(() => compact([graph.getNode(first.id), graph.getNode(second.id)]))
    const actions = createStrokeGeometryActions(editor, nodes)

    actions.setCap('ROUND')
    actions.setJoin('BEVEL')
    expect(graph.getNode(first.id)).toMatchObject({
      strokeCap: 'ROUND',
      strokeJoin: 'BEVEL',
      strokes: [{ cap: 'ROUND', join: 'BEVEL' }]
    })
    expect(graph.getNode(second.id)?.strokes[0]).toMatchObject({ cap: 'ROUND', join: 'BEVEL' })

    editor.undo.undo()
    expect(graph.getNode(first.id)?.strokeJoin).toBe('MITER')
    expect(graph.getNode(second.id)?.strokeJoin).toBe('MITER')
    expect(graph.getNode(first.id)?.strokeCap).toBe('ROUND')
  })

  test('previews and commits miter limit as one multi-selection undo step', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const first = graph.createNode('RECTANGLE', pageId, { strokes: [{ ...DEFAULT_STROKE }] })
    const second = graph.createNode('RECTANGLE', pageId, {
      strokes: [{ ...DEFAULT_STROKE }],
      strokeMiterLimit: 8
    })
    const editor = createEditor({ graph })
    const nodes = computed(() => compact([graph.getNode(first.id), graph.getNode(second.id)]))
    const actions = createStrokeGeometryActions(editor, nodes)

    actions.updateMiterLimit(12)
    expect(graph.getNode(first.id)?.strokeMiterLimit).toBe(12)
    expect(graph.getNode(second.id)?.strokeMiterLimit).toBe(12)
    actions.commitMiterLimit(12)

    editor.undo.undo()
    expect(graph.getNode(first.id)?.strokeMiterLimit).toBe(4)
    expect(graph.getNode(second.id)?.strokeMiterLimit).toBe(8)
  })
})

describe('stroke cap values', () => {
  test('isStrokeCapValue accepts every cap the picker offers and rejects junk', () => {
    for (const value of ['NONE', 'ROUND', 'SQUARE', 'ARROW_LINES', 'ARROW_EQUILATERAL']) {
      expect(isStrokeCapValue(value)).toBe(true)
    }
    expect(isStrokeCapValue('MITER')).toBe(false)
    expect(isStrokeCapValue('')).toBe(false)
  })
})

describe('setCap with per-vertex overrides', () => {
  test('applying a node-wide cap clears per-vertex overrides', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const vector = graph.createNode('VECTOR', pageId, {
      strokes: [{ ...DEFAULT_STROKE }],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const editor = createEditor({ graph })
    const nodes = computed(() => compact([graph.getNode(vector.id)]))
    const actions = createStrokeGeometryActions(editor, nodes)

    actions.setCap('ROUND')
    const updated = graph.getNode(vector.id)
    expect(updated?.strokeCap).toBe('ROUND')
    expect(updated?.vectorNetwork?.vertices.some((vertex) => vertex.strokeCap)).toBe(false)
  })
})

describe('cap state with per-vertex overrides', () => {
  test('differing vertex caps report MIXED so the picker always fires', () => {
    const graph = makeSceneGraph()
    const vector = graph.createNode('VECTOR', firstPageId(graph), {
      strokes: [{ ...DEFAULT_STROKE }],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const nodes = ref([vector])
    const state = createStrokeGeometryState({
      nodes: computed(() => nodes.value),
      merged: (key) => merged(nodes.value)(key)
    })

    expect(state.cap.value).toBe(MIXED)
  })

  test('a vertex cap equal to the node cap is not MIXED', () => {
    const graph = makeSceneGraph()
    const vector = graph.createNode('VECTOR', firstPageId(graph), {
      strokeCap: 'ARROW_EQUILATERAL',
      strokes: [{ ...DEFAULT_STROKE }],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0, strokeCap: 'ARROW_EQUILATERAL' },
          { x: 100, y: 0, strokeCap: 'ARROW_EQUILATERAL' }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const nodes = ref([vector])
    const state = createStrokeGeometryState({
      nodes: computed(() => nodes.value),
      merged: (key) => merged(nodes.value)(key)
    })

    expect(state.cap.value).toBe('ARROW_EQUILATERAL')
  })

  test('setCap resolves MIXED to a concrete cap and undo restores it', () => {
    const graph = makeSceneGraph()
    const vector = graph.createNode('VECTOR', firstPageId(graph), {
      strokes: [{ ...DEFAULT_STROKE }],
      vectorNetwork: {
        vertices: [
          { x: 0, y: 0 },
          { x: 100, y: 0, strokeCap: 'ARROW_LINES' }
        ],
        segments: [{ start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }],
        regions: []
      }
    })
    const editor = createEditor({ graph })
    const nodes = computed(() => compact([graph.getNode(vector.id)]))
    const capState = () =>
      createStrokeGeometryState({ nodes, merged: (key) => merged(nodes.value)(key) }).cap.value

    expect(capState()).toBe(MIXED)
    createStrokeGeometryActions(editor, nodes).setCap('ROUND')
    expect(capState()).toBe('ROUND')
    editor.undo.undo()
    expect(capState()).toBe(MIXED)
  })
})
