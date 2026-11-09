import { computed } from 'vue'

import {
  panelNumber,
  panelPosition,
  panelPositionChange,
  panelRotation,
  panelRotationChange
} from '@open-pencil/core/geometry'
import type { NumericNodeProperty, SceneNode } from '@open-pencil/scene-graph'
import { layerRotates } from '@open-pencil/scene-graph/generated'

import { MIXED, useNodeProps, type MixedValue } from '#vue/controls/node-props/use'
import { usePanelSize } from '#vue/controls/panel-size/use'
import { usePropScrub } from '#vue/controls/prop-scrub/use'
import { useEditor } from '#vue/editor/context'

type PanelProp = 'x' | 'y' | 'rotation' | 'width' | 'height'

/**
 * The selection's X, Y, rotation, width, and height as the Design panel shows and edits them, and
 * its align, flip, rotate, and Ignore auto layout actions.
 */
export function usePosition() {
  const editor = useEditor()

  const { nodes, node, active, isMulti, prop } = useNodeProps()
  const ids = computed(() => nodes.value.map((n) => n.id))
  /** Whether the selection turns and flips; a sticky note or connector stays upright. */
  const rotates = computed(() => nodes.value.every(layerRotates))

  // X, Y, and rotation read as Figma's panel shows them: the turned layer's box on the canvas and
  // its counterclockwise angle; see `panelPosition` and `panelRotation`.
  function shown(target: SceneNode, key: PanelProp): number {
    if (key === 'rotation') return panelNumber(panelRotation(target, editor.graph))
    if (key === 'x' || key === 'y') return panelNumber(panelPosition(target, editor.graph)[key])
    return panelNumber(target[key])
  }

  /** The value the panel shows for the selection, or MIXED when its layers show different ones. */
  function panelProp(key: PanelProp) {
    return computed<MixedValue<number>>(() => {
      const values = nodes.value.map((target) => shown(target, key))
      if (values.length === 0) return 0
      const first = values[0]
      return values.every((value) => value === first) ? first : MIXED
    })
  }

  const scrub = usePropScrub(editor)
  const size = usePanelSize(editor)

  // Typed X, Y, and rotation become each node's own move or turn, as typing them in Figma does.
  function updateProp(key: NumericNodeProperty, value: number) {
    if (key === 'x' || key === 'y') {
      scrub.updateEach(nodes.value, key, (target) =>
        panelPositionChange(target, editor.graph, key, value)
      )
    } else if (key === 'rotation') {
      scrub.updateEach(nodes.value, key, (target) =>
        panelRotationChange(target, editor.graph, value)
      )
    } else if (key === 'width' || key === 'height') {
      size.update(nodes.value, { [key]: value }, () => scrub.updateProp(nodes.value, key, value))
    } else {
      scrub.updateProp(nodes.value, key, value)
    }
  }

  // A size edit may have gone through either path; each commits or cancels only what it opened.
  function commitProp(key: NumericNodeProperty, value: number, previous: number) {
    size.commit()
    scrub.commitProp(nodes.value, key, value, previous)
  }

  function cancelProp(key: NumericNodeProperty) {
    size.cancel()
    scrub.cancelProp(nodes.value, key)
  }

  /** Whether every selected layer sits in an auto layout, where it can ignore that layout. */
  const inAutoLayout = computed(
    () =>
      nodes.value.length > 0 &&
      nodes.value.every((target) => {
        const parent = target.parentId ? editor.graph.getNode(target.parentId) : undefined
        return !!parent && parent.layoutMode !== 'NONE'
      })
  )
  /** On only when every selected layer ignores its auto layout. */
  const ignoresAutoLayout = computed(
    () =>
      inAutoLayout.value && nodes.value.every((target) => target.layoutPositioning === 'ABSOLUTE')
  )

  /** Figma's Ignore auto layout toggle: a mixed selection is taken out of its layouts. */
  function toggleIgnoreAutoLayout() {
    editor.setLayoutPositioning(ids.value, ignoresAutoLayout.value ? 'AUTO' : 'ABSOLUTE')
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
    rotates,
    inAutoLayout,
    ignoresAutoLayout,
    toggleIgnoreAutoLayout,
    updateProp,
    commitProp,
    cancelProp,
    align,
    flip,
    rotate
  }
}
