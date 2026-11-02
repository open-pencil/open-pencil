import { computed } from 'vue'

import type { ConstraintType, SceneNode } from '@lawha/scene-graph'

import {
  isConstraintEligible,
  toggleConstraintPin,
  type ConstraintAxis,
  type ConstraintEdge,
  type ConstraintValue
} from '#vue/controls/constraints/model'
import { MIXED, useNodeProps } from '#vue/controls/node-props/use'

function mergedConstraint(
  nodes: readonly SceneNode[],
  key: 'horizontalConstraint' | 'verticalConstraint'
): ConstraintValue {
  if (nodes.length === 0) return MIXED
  const first = nodes[0][key]
  return nodes.some((node) => node[key] !== first) ? MIXED : first
}

export function useConstraints() {
  const { store, nodes, isMulti } = useNodeProps()
  const active = computed(
    () =>
      nodes.value.length > 0 && nodes.value.every((node) => isConstraintEligible(store.graph, node))
  )
  const horizontal = computed(() => mergedConstraint(nodes.value, 'horizontalConstraint'))
  const vertical = computed(() => mergedConstraint(nodes.value, 'verticalConstraint'))

  function setAxis(axis: ConstraintAxis, value: ConstraintType) {
    if (!active.value) return
    const key = axis === 'horizontal' ? 'horizontalConstraint' : 'verticalConstraint'
    const apply = () => {
      for (const node of nodes.value) {
        store.updateNodeWithUndo(node.id, { [key]: value }, `Change ${axis} constraint`)
      }
    }
    if (nodes.value.length > 1) store.undo.runBatch(`Change ${axis} constraint`, apply)
    else apply()
  }

  function togglePin(axis: ConstraintAxis, edge: ConstraintEdge, additive: boolean) {
    const current = axis === 'horizontal' ? horizontal.value : vertical.value
    setAxis(axis, toggleConstraintPin(current, edge, additive))
  }

  return {
    active,
    isMulti,
    horizontal,
    vertical,
    setAxis,
    togglePin
  }
}
