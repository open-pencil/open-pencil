import { computed } from 'vue'

import { useEditor } from './editorContext'
import { MIXED } from './useNodeProps'
import { usePropScrub } from './usePropScrub'
import { useSceneComputed } from './useSceneComputed'

import type { SceneNode } from '@open-pencil/core'
import type { MixedValue } from './useNodeProps'

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE'
])

export function useAppearance() {
  const editor = useEditor()

  const nodes = useSceneComputed(() => editor.getSelectedNodes())
  const node = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)
  const active = computed(() => nodes.value.length > 0)
  const isMulti = computed(() => nodes.value.length > 1)

  function merged<K extends keyof SceneNode>(key: K): MixedValue<SceneNode[K]> {
    const all = nodes.value
    if (all.length === 0) return MIXED
    const first = all[0][key]
    for (let i = 1; i < all.length; i++) {
      if (all[i][key] !== first) return MIXED
    }
    return first
  }

  const hasCornerRadius = computed(() => {
    if (isMulti.value) return nodes.value.every((n) => CORNER_RADIUS_TYPES.has(n.type))
    return node.value ? CORNER_RADIUS_TYPES.has(node.value.type) : false
  })

  const independentCorners = computed(() => {
    if (isMulti.value) return merged('independentCorners')
    return node.value?.independentCorners ?? false
  })

  const cornerRadiusValue = computed(() => {
    if (isMulti.value) return merged('cornerRadius')
    return node.value?.cornerRadius ?? 0
  })

  const opacityPercent = computed(() => {
    const v = merged('opacity')
    return v === MIXED ? MIXED : Math.round((v as number) * 100)
  })

  const visibilityState = computed<'visible' | 'hidden' | 'mixed'>(() => {
    const v = merged('visible')
    if (v === MIXED) return 'mixed'
    return v ? 'visible' : 'hidden'
  })

  const { updateProp: _updateProp, commitProp: _commitProp } = usePropScrub(editor)

  function updateProp(key: string, value: number | string) {
    _updateProp(nodes.value, key, value)
  }

  function commitProp(key: string, value: number | string, previous: number | string) {
    _commitProp(nodes.value, key, value, previous)
  }

  function toggleVisibility() {
    if (isMulti.value) {
      const allVisible = nodes.value.every((n) => n.visible)
      for (const n of nodes.value) {
        editor.updateNodeWithUndo(n.id, { visible: !allVisible }, 'Toggle visibility')
      }
    } else {
      const n = node.value
      if (!n) return
      editor.updateNodeWithUndo(n.id, { visible: !n.visible }, 'Toggle visibility')
    }
  }

  function toggleIndependentCorners() {
    const targets = isMulti.value ? nodes.value : node.value ? [node.value] : []
    for (const n of targets) {
      if (n.independentCorners) {
        const uniform = n.topLeftRadius
        editor.updateNodeWithUndo(
          n.id,
          {
            independentCorners: false,
            cornerRadius: uniform,
            topLeftRadius: uniform,
            topRightRadius: uniform,
            bottomRightRadius: uniform,
            bottomLeftRadius: uniform
          } as Partial<SceneNode>,
          'Uniform corner radius'
        )
      } else {
        editor.updateNodeWithUndo(
          n.id,
          {
            independentCorners: true,
            topLeftRadius: n.cornerRadius,
            topRightRadius: n.cornerRadius,
            bottomRightRadius: n.cornerRadius,
            bottomLeftRadius: n.cornerRadius
          } as Partial<SceneNode>,
          'Independent corner radii'
        )
      }
    }
  }

  function updateCornerProp(key: string, value: number) {
    if (isMulti.value) {
      for (const n of nodes.value) editor.updateNode(n.id, { [key]: value })
    } else {
      const n = node.value
      if (n) editor.updateNode(n.id, { [key]: value })
    }
  }

  function commitCornerProp(key: string, _value: number, previous: number) {
    if (isMulti.value) {
      for (const n of nodes.value) {
        editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
      }
    } else {
      const n = node.value
      if (n) editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
    }
  }

  return {
    editor,
    nodes,
    node,
    active,
    isMulti,
    hasCornerRadius,
    independentCorners,
    cornerRadiusValue,
    opacityPercent,
    visibilityState,
    updateProp,
    commitProp,
    toggleVisibility,
    toggleIndependentCorners,
    updateCornerProp,
    commitCornerProp
  }
}
