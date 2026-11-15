import { uniqBy } from 'es-toolkit/array'
import { computed, shallowRef } from 'vue'

import type { ConstraintType } from '@open-pencil/scene-graph'
import {
  constraintLayers,
  isConstraintEligible,
  sharedConstraint
} from '@open-pencil/scene-graph/constraints'

import {
  toggleConstraintPin,
  type ConstraintAxis,
  type ConstraintEdge,
  type ConstraintValue
} from '#vue/controls/constraints/model'
import { MIXED, useNodeProps } from '#vue/controls/node-props/use'
import { useEditorEvent } from '#vue/editor/events/use'

export function useConstraints() {
  const { store, nodes, isMulti } = useNodeProps()
  const active = computed(
    () =>
      nodes.value.length > 0 && nodes.value.every((node) => isConstraintEligible(store.graph, node))
  )
  // A group or boolean owns no constraints: it shows and sets those of the layers in it, which the
  // selection does not follow, so an edit to one of them refreshes it here.
  const revision = shallowRef(0)
  const layers = computed(() => {
    void revision.value
    return uniqBy(
      nodes.value.flatMap((node) => constraintLayers(store.graph, node)),
      (layer) => layer.id
    )
  })
  const layerIds = computed(() => new Set(layers.value.map((layer) => layer.id)))
  useEditorEvent('node:updated', (id) => {
    if (layerIds.value.has(id)) revision.value++
  })
  const horizontal = computed<ConstraintValue>(
    () => sharedConstraint(layers.value, 'horizontalConstraint') ?? MIXED
  )
  const vertical = computed<ConstraintValue>(
    () => sharedConstraint(layers.value, 'verticalConstraint') ?? MIXED
  )

  function setAxis(axis: ConstraintAxis, value: ConstraintType) {
    if (!active.value) return
    const key = axis === 'horizontal' ? 'horizontalConstraint' : 'verticalConstraint'
    const targets = layers.value
    const apply = () => {
      for (const layer of targets) {
        store.updateNodeWithUndo(layer.id, { [key]: value }, `Change ${axis} constraint`)
      }
    }
    if (targets.length > 1) store.undo.runBatch(`Change ${axis} constraint`, apply)
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
