import { computed } from 'vue'

import { useEditor } from './editorContext'
import { usePropScrub } from './usePropScrub'
import { useSceneComputed } from './useSceneComputed'

import type { SceneNode } from '@open-pencil/core'

export function usePosition() {
  const editor = useEditor()

  const nodes = useSceneComputed(() => editor.getSelectedNodes())
  const node = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)
  const active = computed(() => nodes.value.length > 0)
  const isMulti = computed(() => nodes.value.length > 1)
  const ids = computed(() => nodes.value.map((n) => n.id))

  const x = computed(() => Math.round(node.value?.x ?? 0))
  const y = computed(() => Math.round(node.value?.y ?? 0))
  const width = computed(() => node.value?.width ?? 0)
  const height = computed(() => node.value?.height ?? 0)
  const rotation = computed(() => Math.round(node.value?.rotation ?? 0))

  const { updateProp: _updateProp, commitProp: _commitProp } = usePropScrub(editor)

  function updateProp(key: string, value: number) {
    _updateProp(nodes.value, key, value)
  }

  function commitProp(key: string, value: number, previous: number) {
    _commitProp(nodes.value, key, value, previous)
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
    ids,
    x,
    y,
    width,
    height,
    rotation,
    updateProp,
    commitProp,
    align,
    flip,
    rotate
  }
}
