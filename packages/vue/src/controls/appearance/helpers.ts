import { compact } from 'es-toolkit'
import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { BlendMode, SceneNode } from '@open-pencil/scene-graph'

import type { CornerGeometryKey, CornerRadiusKey } from '#vue/controls/appearance/types'
import { MIXED, type MixedValue } from '#vue/controls/node-props/use'

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE',
  'POLYGON',
  'STAR'
])

/** A polygon's or star's corners share one radius, so Figma offers no per-corner radii for them. */
const SHARED_RADIUS_TYPES = new Set(['POLYGON', 'STAR'])

const CORNER_PATHS: CornerRadiusKey[] = [
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius'
]

type AppearanceStateOptions = {
  expandedCornerNodeId?: Ref<string | null>
  node: ComputedRef<SceneNode | null>
  nodes: ComputedRef<SceneNode[]>
  isMulti: ComputedRef<boolean>
  merged: <K extends keyof SceneNode>(key: K) => MixedValue<SceneNode[K]>
}

type AppearanceActionOptions = AppearanceStateOptions & {
  editor: Editor
}

function supportsCornerRadius(node: SceneNode) {
  return CORNER_RADIUS_TYPES.has(node.type)
}

/** The value shared by every node, MIXED when they differ, or `empty` when there are none. */
function sharedValue<T>(values: readonly T[], empty: T): MixedValue<T> {
  if (values.length === 0) return empty
  const [first] = values
  return values.every((value) => value === first) ? first : MIXED
}

function cornersHaveEquivalentBindings(node: SceneNode): boolean {
  const first = node.boundVariables.topLeftRadius
  if (!first) return false
  return [
    node.boundVariables.topRightRadius,
    node.boundVariables.bottomRightRadius,
    node.boundVariables.bottomLeftRadius
  ].every((id) => id === first)
}

function hasUnequalCorners(node: SceneNode) {
  return !(
    node.topLeftRadius === node.topRightRadius &&
    node.topLeftRadius === node.bottomRightRadius &&
    node.topLeftRadius === node.bottomLeftRadius
  )
}

export function createAppearanceState({
  node,
  nodes,
  isMulti,
  merged,
  expandedCornerNodeId
}: AppearanceStateOptions) {
  // Figma shows the radius for any multi-selection and edits only the layers that have one; with
  // none among them the field is disabled.
  const cornerNodes = computed(() => nodes.value.filter(supportsCornerRadius))
  const hasCornerRadius = computed(() => {
    if (isMulti.value) return true
    return node.value ? supportsCornerRadius(node.value) : false
  })
  const cornerRadiusDisabled = computed(() => isMulti.value && cornerNodes.value.length === 0)
  const splitsCorners = computed(() => {
    const targets = isMulti.value ? cornerNodes.value : compact([node.value])
    return targets.every((target) => !SHARED_RADIUS_TYPES.has(target.type))
  })

  const independentCorners = computed(() => {
    if (isMulti.value)
      return sharedValue(
        cornerNodes.value.map((n) => n.independentCorners),
        false
      )
    return node.value?.independentCorners ?? false
  })

  const showIndependentCorners = computed(() => {
    if (isMulti.value || !splitsCorners.value) return false
    const selected = node.value
    return selected
      ? expandedCornerNodeId?.value === selected.id ||
          hasUnequalCorners(selected) ||
          (selected.independentCorners && !cornersHaveEquivalentBindings(selected))
      : false
  })

  const cornerRadiusValue = computed(() => {
    if (isMulti.value)
      return sharedValue(
        cornerNodes.value.map((n) => n.cornerRadius),
        0
      )
    const selected = node.value
    return selected &&
      splitsCorners.value &&
      cornersHaveEquivalentBindings(selected) &&
      !hasUnequalCorners(selected)
      ? selected.topLeftRadius
      : (selected?.cornerRadius ?? 0)
  })

  const cornerRadiusBindingPaths = computed<Array<CornerRadiusKey | 'cornerRadius'>>(() => {
    const selected = node.value
    return selected &&
      splitsCorners.value &&
      cornersHaveEquivalentBindings(selected) &&
      !hasUnequalCorners(selected)
      ? CORNER_PATHS
      : ['cornerRadius']
  })

  // Figma shows a polygon's or star's point count, and a star's inner ratio, while every selected
  // layer has one.
  const selectedNodes = computed(() => (isMulti.value ? nodes.value : compact([node.value])))
  const hasPointCount = computed(
    () =>
      selectedNodes.value.length > 0 &&
      selectedNodes.value.every((target) => SHARED_RADIUS_TYPES.has(target.type))
  )
  const hasStarRatio = computed(
    () =>
      selectedNodes.value.length > 0 &&
      selectedNodes.value.every((target) => target.type === 'STAR')
  )
  const pointCount = computed(() =>
    sharedValue(
      selectedNodes.value.map((target) => target.pointCount),
      0
    )
  )
  const starRatioPercent = computed(() =>
    sharedValue(
      selectedNodes.value.map((target) => Math.round(target.starInnerRadius * 1000) / 10),
      0
    )
  )

  const cornerSmoothingPercent = computed(() => {
    const value = isMulti.value
      ? sharedValue(
          cornerNodes.value.map((n) => n.cornerSmoothing),
          0
        )
      : merged('cornerSmoothing')
    return value === MIXED ? MIXED : Math.round(Math.max(0, Math.min(value, 1)) * 100)
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
    cornerRadiusDisabled,
    splitsCorners,
    hasPointCount,
    hasStarRatio,
    pointCount,
    starRatioPercent,
    independentCorners,
    showIndependentCorners,
    cornerRadiusValue,
    cornerRadiusBindingPaths,
    cornerSmoothingPercent,
    opacityPercent,
    blendModeValue,
    visibilityState
  }
}

export function createAppearanceActions({
  editor,
  node,
  nodes,
  isMulti,
  expandedCornerNodeId
}: AppearanceActionOptions) {
  const previousCornerValues = new Map<CornerGeometryKey, Map<string, number>>()

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
    if (
      !isMulti.value &&
      selected &&
      expandedCornerNodeId &&
      cornersHaveEquivalentBindings(selected) &&
      !hasUnequalCorners(selected)
    ) {
      expandedCornerNodeId.value = expandedCornerNodeId.value === selected.id ? null : selected.id
      return
    }
    const targets = cornerTargets()
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

  function cornerTargets() {
    if (isMulti.value) return nodes.value.filter(supportsCornerRadius)
    const selected = node.value
    return selected ? [selected] : []
  }

  function updateCornerProp(key: CornerGeometryKey, value: number) {
    let snapshots = previousCornerValues.get(key)
    if (!snapshots) {
      snapshots = new Map()
      previousCornerValues.set(key, snapshots)
    }
    const normalized = key === 'cornerSmoothing' ? Math.max(0, Math.min(value, 1)) : value
    for (const target of cornerTargets()) {
      if (!snapshots.has(target.id)) snapshots.set(target.id, target[key])
      editor.updateNode(target.id, { [key]: normalized })
    }
  }

  function commitCornerProp(key: CornerGeometryKey, _value: number, previous: number) {
    const targets = cornerTargets()
    const snapshots = previousCornerValues.get(key)
    const commit = () => {
      for (const target of targets) {
        editor.commitNodeUpdate(
          target.id,
          { [key]: snapshots?.get(target.id) ?? previous } as Partial<SceneNode>,
          `Change ${key}`
        )
      }
    }
    if (targets.length > 1) editor.undo.runBatch(`Change ${key}`, commit)
    else commit()
    previousCornerValues.delete(key)
  }

  type UniformCorners = Pick<SceneNode, CornerRadiusKey | 'cornerRadius' | 'independentCorners'>
  const previousUniformCorners = new Map<string, UniformCorners>()

  function updateUniformRadius(value: number) {
    for (const target of cornerTargets()) {
      if (!previousUniformCorners.has(target.id)) {
        previousUniformCorners.set(target.id, {
          cornerRadius: target.cornerRadius,
          independentCorners: target.independentCorners,
          topLeftRadius: target.topLeftRadius,
          topRightRadius: target.topRightRadius,
          bottomRightRadius: target.bottomRightRadius,
          bottomLeftRadius: target.bottomLeftRadius
        })
      }
      const previous = previousUniformCorners.get(target.id)
      if (
        previous &&
        value === (previous.independentCorners ? previous.topLeftRadius : previous.cornerRadius)
      ) {
        editor.updateNode(target.id, previous)
        previousUniformCorners.delete(target.id)
        continue
      }
      editor.updateNode(target.id, {
        cornerRadius: value,
        independentCorners: false,
        topLeftRadius: value,
        topRightRadius: value,
        bottomRightRadius: value,
        bottomLeftRadius: value
      })
    }
  }

  function commitUniformRadius() {
    editor.undo.runBatch('Change corner radius', () => {
      for (const [id, previous] of previousUniformCorners) {
        editor.commitNodeUpdate(id, previous, 'Change corner radius')
      }
    })
    previousUniformCorners.clear()
  }

  return {
    updateUniformRadius,
    commitUniformRadius,
    setBlendMode,
    toggleVisibility,
    toggleIndependentCorners,
    updateCornerProp,
    commitCornerProp
  }
}
