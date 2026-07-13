import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { BlendMode, SceneNode } from '@open-pencil/scene-graph'

import type { CornerRadiusKey } from '#vue/controls/appearance/types'
import { MIXED, type MixedValue } from '#vue/controls/node-props/use'

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE'
])

type AppearanceStateOptions = {
  node: ComputedRef<SceneNode | null>
  nodes: ComputedRef<SceneNode[]>
  isMulti: ComputedRef<boolean>
  merged: <K extends keyof SceneNode>(key: K) => MixedValue<SceneNode[K]>
}

type AppearanceActionOptions = AppearanceStateOptions & {
  editor: Editor
}

function hasUnequalCorners(node: SceneNode) {
  return !(
    node.topLeftRadius === node.topRightRadius &&
    node.topLeftRadius === node.bottomRightRadius &&
    node.topLeftRadius === node.bottomLeftRadius
  )
}

export function createAppearanceState({ node, nodes, isMulti, merged }: AppearanceStateOptions) {
  const hasCornerRadius = computed(() => {
    if (isMulti.value) return nodes.value.every((n) => CORNER_RADIUS_TYPES.has(n.type))
    return node.value ? CORNER_RADIUS_TYPES.has(node.value.type) : false
  })

  const independentCorners = computed(() => {
    if (isMulti.value) return merged('independentCorners')
    return node.value?.independentCorners ?? false
  })

  const showIndependentCorners = computed(() => {
    if (isMulti.value) return false
    const selected = node.value
    return selected ? selected.independentCorners || hasUnequalCorners(selected) : false
  })

  const cornerRadiusValue = computed(() => {
    if (isMulti.value) return merged('cornerRadius')
    return node.value?.cornerRadius ?? 0
  })

  const opacityPercent = computed(() => {
    const v = merged('opacity')
    return v === MIXED ? MIXED : Math.round(v * 100)
  })

  const blendModeValue = computed(() => {
    const v = merged('blendMode')
    return v === MIXED ? MIXED : v
  })

  const visibilityState = computed<'visible' | 'hidden' | 'mixed'>(() => {
    const v = merged('visible')
    if (v === MIXED) return 'mixed'
    return v ? 'visible' : 'hidden'
  })

  return {
    hasCornerRadius,
    independentCorners,
    showIndependentCorners,
    cornerRadiusValue,
    opacityPercent,
    blendModeValue,
    visibilityState
  }
}

export function createAppearanceActions({ editor, node, nodes, isMulti }: AppearanceActionOptions) {
  function setBlendMode(value: BlendMode) {
    const selected = node.value
    const targets = isMulti.value ? nodes.value : []
    if (!isMulti.value && selected) targets.push(selected)
    const changed = targets.filter((target) => target.blendMode !== value)
    if (changed.length === 0) return

    editor.undo.runBatch('Change blend mode', () => {
      for (const target of changed) {
        editor.updateNodeWithUndo(target.id, { blendMode: value }, 'Change blend mode')
      }
    })
  }

  function toggleVisibility() {
    if (isMulti.value) {
      const liveNodes = nodes.value
        .map((n) => editor.getNode(n.id))
        .filter((n): n is SceneNode => n != null)
      if (liveNodes.length === 0) return
      const allVisible = liveNodes.every((n) => n.visible)
      editor.undo.runBatch('Toggle visibility', () => {
        for (const n of liveNodes) {
          editor.updateNodeWithUndo(n.id, { visible: !allVisible }, 'Toggle visibility')
        }
      })
      return
    }

    const selected = node.value
    if (!selected) return
    const liveNode = editor.getNode(selected.id)
    if (!liveNode) return
    editor.updateNodeWithUndo(liveNode.id, { visible: !liveNode.visible }, 'Toggle visibility')
  }

  function toggleIndependentCorners() {
    const selected = node.value
    const targets = isMulti.value ? [...nodes.value] : []
    if (!isMulti.value && selected) targets.push(selected)
    if (targets.length === 0) return
    const makeIndependent = !targets.every(
      (target) => target.independentCorners || hasUnequalCorners(target)
    )

    editor.undo.runBatch(
      makeIndependent ? 'Independent corner radii' : 'Uniform corner radius',
      () => {
        for (const target of targets) {
          if (makeIndependent) {
            if (target.independentCorners) continue
            editor.updateNodeWithUndo(
              target.id,
              {
                independentCorners: true,
                topLeftRadius: target.cornerRadius,
                topRightRadius: target.cornerRadius,
                bottomRightRadius: target.cornerRadius,
                bottomLeftRadius: target.cornerRadius
              } as Partial<SceneNode>,
              'Independent corner radii'
            )
          } else {
            const uniform = target.topLeftRadius
            editor.updateNodeWithUndo(
              target.id,
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
          }
        }
      }
    )
  }

  function updateCornerProp(key: CornerRadiusKey, value: number) {
    if (isMulti.value) {
      for (const n of nodes.value) editor.updateNode(n.id, { [key]: value })
    } else {
      const n = node.value
      if (n) editor.updateNode(n.id, { [key]: value })
    }
  }

  function commitCornerProp(key: CornerRadiusKey, _value: number, previous: number) {
    if (isMulti.value) {
      editor.undo.runBatch(`Change ${key}`, () => {
        for (const n of nodes.value) {
          editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
        }
      })
    } else {
      const n = node.value
      if (n) {
        editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
      }
    }
  }

  return {
    setBlendMode,
    toggleVisibility,
    toggleIndependentCorners,
    updateCornerProp,
    commitCornerProp
  }
}
