import { describe, expect, test } from 'bun:test'

import { computed, ref } from 'vue'

import { createEditor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'
import { MIXED, type MixedValue } from '@open-pencil/vue'

import { createAppearanceActions, createAppearanceState } from '#vue/controls/appearance/helpers'

import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

function appearanceState(node: SceneNode, multi = false) {
  const selected = ref<SceneNode | null>(node)
  const nodes = ref<SceneNode[]>([node])
  const isMulti = ref(multi)

  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    const current = selected.value
    if (!current) throw new Error('Expected selected node')
    return current[key]
  }

  return createAppearanceState({
    node: computed(() => selected.value),
    nodes: computed(() => nodes.value),
    isMulti: computed(() => isMulti.value),
    merged
  })
}

function rectangle() {
  const graph = makeSceneGraph()
  return createRect(graph, firstPageId(graph))
}

describe('appearance control state', () => {
  test('keeps equal uniform corners collapsed', () => {
    const state = appearanceState(rectangle())
    expect(state.showIndependentCorners.value).toBe(false)
  })

  test('expands corners when the explicit independent flag is set', () => {
    const node = rectangle()
    node.independentCorners = true
    const state = appearanceState(node)
    expect(state.showIndependentCorners.value).toBe(true)
  })

  test('collapses equal independent corners when they share one binding', () => {
    const node = rectangle()
    node.independentCorners = true
    node.boundVariables = {
      topLeftRadius: 'radius',
      topRightRadius: 'radius',
      bottomRightRadius: 'radius',
      bottomLeftRadius: 'radius'
    }
    expect(appearanceState(node).showIndependentCorners.value).toBe(false)
  })

  test('keeps equal independent corners expanded for distinct bindings', () => {
    const node = rectangle()
    node.independentCorners = true
    node.boundVariables = {
      topLeftRadius: 'radius-a',
      topRightRadius: 'radius-b',
      bottomRightRadius: 'radius-a',
      bottomLeftRadius: 'radius-a'
    }
    expect(appearanceState(node).showIndependentCorners.value).toBe(true)
  })

  test('expands imported unequal corners when the explicit flag is stale', () => {
    const node = rectangle()
    node.independentCorners = false
    node.topLeftRadius = 4
    node.topRightRadius = 12
    const state = appearanceState(node)
    expect(state.showIndependentCorners.value).toBe(true)
  })

  test('leaves the per-corner editor collapsed for multi-selection', () => {
    const node = rectangle()
    node.independentCorners = true
    const state = appearanceState(node, true)
    expect(state.showIndependentCorners.value).toBe(false)
  })

  test('presents normalized corner smoothing as a percentage', () => {
    const node = rectangle()
    node.cornerSmoothing = 0.735
    const state = appearanceState(node)
    expect(state.cornerSmoothingPercent.value).toBe(74)
  })

  test('keeps independent corner preview and undo behavior', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const rect = graph.createNode('RECTANGLE', pageId, {
      independentCorners: true,
      topLeftRadius: 8
    })
    const editor = createEditor({ graph })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => graph.getNode(rect.id) ?? null),
      nodes: computed(() => []),
      isMulti: computed(() => false),
      merged: (key) => graph.getNode(rect.id)?.[key] ?? MIXED
    })

    actions.updateCornerProp('topLeftRadius', 20)
    actions.commitCornerProp('topLeftRadius', 20, 8)
    expect(graph.getNode(rect.id)?.topLeftRadius).toBe(20)
    editor.undo.undo()
    expect(graph.getNode(rect.id)?.topLeftRadius).toBe(8)
  })

  test('restores each mixed smoothing value in one undo step', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const first = graph.createNode('RECTANGLE', pageId, { cornerSmoothing: 0.2 })
    const second = graph.createNode('RECTANGLE', pageId, { cornerSmoothing: 0.8 })
    const editor = createEditor({ graph })
    const nodes = computed(() => {
      const selected = [graph.getNode(first.id), graph.getNode(second.id)]
      return selected.filter((value): value is SceneNode => value !== undefined)
    })
    const actions = createAppearanceActions({
      editor,
      node: computed(() => null),
      nodes,
      isMulti: computed(() => true),
      merged: () => MIXED
    })

    actions.updateCornerProp('cornerSmoothing', 1.4)
    expect(graph.getNode(first.id)?.cornerSmoothing).toBe(1)
    expect(graph.getNode(second.id)?.cornerSmoothing).toBe(1)
    actions.commitCornerProp('cornerSmoothing', 1, 0)

    editor.undo.undo()
    expect(graph.getNode(first.id)?.cornerSmoothing).toBe(0.2)
    expect(graph.getNode(second.id)?.cornerSmoothing).toBe(0.8)
  })
})
