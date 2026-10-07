import { computed } from 'vue'

import {
  panelPosition,
  panelPositionChange,
  panelRotation,
  panelRotationChange
} from '@open-pencil/core/geometry'
import type { NumericNodeProperty, SceneNode } from '@open-pencil/scene-graph'

import { MIXED, useNodeProps, type MixedValue } from '#vue/controls/node-props/use'
import { usePropScrub } from '#vue/controls/prop-scrub/use'
import { useEditor } from '#vue/editor/context'

/**
 * Returns position-related state and actions for the current selection.
 *
 * This composable is designed for property panels that edit x/y, size,
 * rotation, alignment, flipping, and multi-node transforms.
 */
export function usePosition() {
  const editor = useEditor()

  const { nodes, node, active, isMulti, prop } = useNodeProps()
  const ids = computed(() => nodes.value.map((n) => n.id))

  // X, Y, and rotation read as Figma's panel shows them: the turned layer's box on the canvas and
  // its counterclockwise angle; see `panelPosition` and `panelRotation`.
  function shown(target: SceneNode, key: 'x' | 'y' | 'rotation'): number {
    if (key === 'rotation') return Math.round(panelRotation(target, editor.graph))
    return Math.round(panelPosition(target, editor.graph)[key])
  }

  /** The shown value of every selected node, or MIXED when they differ. */
  function panelProp(key: 'x' | 'y' | 'rotation') {
    return computed<MixedValue<number>>(() => {
      const values = nodes.value.map((target) => shown(target, key))
      if (values.length === 0) return 0
      const first = values[0]
      return values.every((value) => value === first) ? first : MIXED
    })
  }

  const x = computed(() => (node.value ? shown(node.value, 'x') : 0))
  const y = computed(() => (node.value ? shown(node.value, 'y') : 0))
  const width = computed(() => node.value?.width ?? 0)
  const height = computed(() => node.value?.height ?? 0)
  const rotation = computed(() => (node.value ? shown(node.value, 'rotation') : 0))

  const {
    updateProp: _updateProp,
    updateEach,
    commitProp: _commitProp,
    cancelProp: _cancelProp
  } = usePropScrub(editor)

  // Typed X, Y, and rotation become each node's own move or turn, as typing them in Figma does.
  function updateProp(key: NumericNodeProperty, value: number) {
    if (key === 'x' || key === 'y') {
      updateEach(nodes.value, key, (target) =>
        panelPositionChange(target, editor.graph, key, value)
      )
    } else if (key === 'rotation') {
      updateEach(nodes.value, key, (target) => panelRotationChange(target, editor.graph, value))
    } else {
      _updateProp(nodes.value, key, value)
    }
  }

  function commitProp(key: NumericNodeProperty, value: number, previous: number) {
    _commitProp(nodes.value, key, value, previous)
  }

  function cancelProp(key: NumericNodeProperty) {
    _cancelProp(nodes.value, key)
  }

  function align(axis: 'horizontal' | 'vertical', pos: 'min' | 'center' | 'max') {
    editor.alignNodes(ids.value, axis, pos)
  }

  function flip(axis: 'horizontal' | 'vertical') {
    editor.flipNodes(ids.value, axis)
  }

  function rotate(degrees: number) {
    editor.rotateNodes(ids.value, degrees)
  }

  return {
    editor,
    nodes,
    node,
    active,
    isMulti,
    prop,
    panelProp,
    ids,
    x,
    y,
    width,
    height,
    rotation,
    updateProp,
    commitProp,
    cancelProp,
    align,
    flip,
    rotate
  }
}
