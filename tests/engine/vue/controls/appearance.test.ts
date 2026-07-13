import { describe, expect, test } from 'bun:test'

import { computed, ref } from 'vue'

import type { SceneNode } from '@open-pencil/scene-graph'
import type { MixedValue } from '@open-pencil/vue'

import { createAppearanceState } from '#vue/controls/appearance/helpers'

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
})
