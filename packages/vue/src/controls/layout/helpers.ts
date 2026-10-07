import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import {
  layoutSizing,
  layoutSizingOptions,
  layoutSizingUpdates,
  type GridTrack,
  type LayoutAlign,
  type LayoutCounterAlign,
  type LayoutSizing,
  type LayoutSizingAxis,
  type NumericNodeProperty,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { useNodePreview } from '#vue/controls/node-preview/use'
import { useSelectedNodeState } from '#vue/editor/selection-state/nodes'
import type { useI18n } from '#vue/i18n'

export type AlignCell = { primary: LayoutAlign; counter: LayoutCounterAlign }

type GridTrackProp = 'gridTemplateColumns' | 'gridTemplateRows'

type LayoutPanelStrings = {
  sizingFixed: string
  sizingHug: string
  sizingFill: string
}

export type LayoutAxis = 'width' | 'height'
export type SizeLimitProp = 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight'

type ValueRef<T> = { readonly value: T }

export const ALIGN_HORIZONTAL: AlignCell[] = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MAX' }
]

export const ALIGN_VERTICAL: AlignCell[] = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MAX', counter: 'MAX' }
]

export function createLayoutSelectionState(
  editor: Editor,
  panels: ReturnType<typeof useI18n>['panels']
) {
  const { node } = useSelectedNodeState(editor)
  const layoutDirection = computed<SceneNode['layoutDirection']>(
    () => node.value?.layoutDirection ?? 'AUTO'
  )
  const sizingState = createLayoutSizingState(editor, node, panels)
  const gapAuto = computed(() => node.value?.primaryAxisAlign === 'SPACE_BETWEEN')
  const alignGrid = computed(() =>
    node.value?.layoutMode === 'VERTICAL' ? ALIGN_VERTICAL : ALIGN_HORIZONTAL
  )

  return { node, layoutDirection, gapAuto, alignGrid, ...sizingState }
}

export function createTrackSizingOptions(panels: ReturnType<typeof useI18n>['panels']['value']) {
  return [
    { value: 'FR' as const, label: panels.sizingFillFr },
    { value: 'FIXED' as const, label: panels.sizingFixedPx },
    { value: 'AUTO' as const, label: panels.auto }
  ]
}

export function trackLabel(track: GridTrack): string {
  if (track.sizing === 'FR') return `${track.value}fr`
  if (track.sizing === 'FIXED') return `${track.value}px`
  return 'Auto'
}

export function createGridTrackActions(editor: Editor, node: ComputedRef<SceneNode | null>) {
  function updateGridTrack(prop: GridTrackProp, index: number, updates: Partial<GridTrack>) {
    if (!node.value) return
    const tracks = [...node.value[prop]]
    tracks[index] = { ...tracks[index], ...updates }
    editor.updateNodeWithUndo(node.value.id, { [prop]: tracks }, 'Change grid track')
  }

  function addTrack(prop: GridTrackProp) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { [prop]: [...node.value[prop], { sizing: 'FR' as const, value: 1 }] },
      'Add grid track'
    )
  }

  function removeTrack(prop: GridTrackProp, index: number) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { [prop]: node.value[prop].filter((_: GridTrack, i: number) => i !== index) },
      'Remove grid track'
    )
  }

  return { updateGridTrack, addTrack, removeTrack }
}

export function createPaddingActions(editor: Editor, node: ComputedRef<SceneNode | null>) {
  const showIndividualPadding = ref(false)
  const preview = useNodePreview(editor)

  const hasUniformPadding = computed(() => {
    const n = node.value
    if (!n) return true
    return (
      n.paddingTop === n.paddingRight &&
      n.paddingRight === n.paddingBottom &&
      n.paddingBottom === n.paddingLeft
    )
  })

  const hasSymmetricPadding = computed(() => {
    const n = node.value
    if (!n) return true
    return n.paddingLeft === n.paddingRight && n.paddingTop === n.paddingBottom
  })

  function setHorizontalPadding(v: number) {
    if (!node.value) return
    preview.update(
      [node.value.id],
      { paddingLeft: v, paddingRight: v },
      'Change horizontal padding'
    )
  }

  function commitHorizontalPadding(_value: number, _previous: number) {
    preview.commit()
  }

  function setVerticalPadding(v: number) {
    if (!node.value) return
    preview.update([node.value.id], { paddingTop: v, paddingBottom: v }, 'Change vertical padding')
  }

  function commitVerticalPadding(_value: number, _previous: number) {
    preview.commit()
  }

  function toggleIndividualPadding() {
    showIndividualPadding.value = !showIndividualPadding.value
  }

  return {
    cancelPaddingPreview: preview.cancel,
    showIndividualPadding,
    hasUniformPadding,
    hasSymmetricPadding,
    setHorizontalPadding,
    commitHorizontalPadding,
    setVerticalPadding,
    commitVerticalPadding,
    toggleIndividualPadding
  }
}

function sizingAxis(axis: LayoutAxis): LayoutSizingAxis {
  return axis === 'width' ? 'HORIZONTAL' : 'VERTICAL'
}

export function axisSizingPatchForNode(
  graph: SceneGraph,
  node: SceneNode,
  axis: LayoutAxis,
  sizing: LayoutSizing
): Partial<SceneNode> {
  return layoutSizingUpdates(graph, node, sizingAxis(axis), sizing)
}

export function createLayoutActions({
  editor,
  node
}: {
  editor: Editor
  node: ComputedRef<SceneNode | null>
}) {
  const preview = useNodePreview(editor)

  function updateProp(key: NumericNodeProperty, value: number) {
    if (node.value) preview.update([node.value.id], { [key]: value }, `Change ${key}`)
  }

  function updateSizeLimit(prop: SizeLimitProp, value: number) {
    if (!node.value) return
    preview.update([node.value.id], { [prop]: value }, `Change ${prop}`)
  }

  function setSizeLimitToCurrent(prop: SizeLimitProp) {
    const n = node.value
    if (!n) return
    const value = prop === 'minWidth' || prop === 'maxWidth' ? n.width : n.height
    editor.updateNodeWithUndo(n.id, { [prop]: Math.round(value) }, `Set ${prop}`)
  }

  function commitSizeLimit(_prop: SizeLimitProp, _value: number, _previous: number) {
    preview.commit()
  }

  function addSizeLimit(prop: SizeLimitProp) {
    const n = node.value
    if (!n) return
    const fallback = prop === 'minWidth' || prop === 'maxWidth' ? n.width : n.height
    editor.updateNodeWithUndo(n.id, { [prop]: Math.round(fallback) }, `Add ${prop}`)
  }

  function removeSizeLimit(prop: SizeLimitProp) {
    if (!node.value) return
    editor.updateNodeWithUndo(node.value.id, { [prop]: null }, `Remove ${prop}`)
  }

  function commitProp(_key: NumericNodeProperty, _value: number, _previous: number) {
    preview.commit()
  }

  function setAxisSizing(axis: LayoutAxis, sizing: LayoutSizing) {
    const n = node.value
    if (!n) return
    editor.updateNodeWithUndo(
      n.id,
      axisSizingPatchForNode(editor.graph, n, axis, sizing),
      `Set ${axis} sizing`
    )
  }

  function updateAxisSize(axis: LayoutAxis, value: number) {
    const n = node.value
    if (!n) return
    const sizing = axisSizingForNode(editor.graph, n, axis)
    const sizingPatch =
      sizing !== 'FIXED' ? axisSizingPatchForNode(editor.graph, n, axis, 'FIXED') : {}
    preview.update([n.id], { ...sizingPatch, [axis]: value }, `Change ${axis}`)
  }

  function commitAxisSize(_axis: LayoutAxis, _value: number, _previous: number) {
    preview.commit()
  }

  function setAlignment(primary: LayoutAlign, counter: LayoutCounterAlign) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { primaryAxisAlign: primary, counterAxisAlign: counter },
      'Change alignment'
    )
  }

  function setGapAuto(enabled: boolean) {
    const n = node.value
    if (!n) return
    editor.updateNodeWithUndo(
      n.id,
      { primaryAxisAlign: enabled ? 'SPACE_BETWEEN' : 'MIN' },
      enabled ? 'Set gap to auto' : 'Set gap to fixed'
    )
  }

  function setLayoutDirection(direction: SceneNode['layoutDirection']) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { layoutDirection: direction },
      'Change layout direction'
    )
  }

  return {
    cancelPreview: preview.cancel,
    updateProp,
    updateSizeLimit,
    setSizeLimitToCurrent,
    commitSizeLimit,
    addSizeLimit,
    removeSizeLimit,
    commitProp,
    setAxisSizing,
    updateAxisSize,
    commitAxisSize,
    setAlignment,
    setGapAuto,
    setLayoutDirection
  }
}

export function axisSizingForNode(
  graph: SceneGraph,
  node: SceneNode | null,
  axis: LayoutAxis
): LayoutSizing {
  return node ? layoutSizing(graph, node, sizingAxis(axis)) : 'FIXED'
}

export function sizingOptionsForNode(
  graph: SceneGraph,
  node: SceneNode | null,
  labels: Partial<Record<LayoutSizing, string>> = {}
): { value: LayoutSizing; label: string }[] {
  const allowed = node ? layoutSizingOptions(graph, node) : []
  // A node outside auto-layout still shows its fixed size.
  const values: LayoutSizing[] = allowed.length > 0 ? allowed : ['FIXED']
  const fallback: Record<LayoutSizing, string> = { FIXED: 'Fixed', HUG: 'Hug', FILL: 'Fill' }
  return values.map((value) => ({ value, label: labels[value] ?? fallback[value] }))
}

export function createLayoutSizingState(
  editor: Editor,
  node: ComputedRef<SceneNode | null>,
  panels: ValueRef<LayoutPanelStrings>
) {
  const isInAutoLayout = computed(() => {
    const n = node.value
    if (!n?.parentId) return false
    const parent = editor.getNode(n.parentId)
    return parent ? parent.layoutMode !== 'NONE' : false
  })

  const isGrid = computed(() => node.value?.layoutMode === 'GRID')
  const isFlex = computed(
    () => node.value?.layoutMode === 'HORIZONTAL' || node.value?.layoutMode === 'VERTICAL'
  )
  const widthSizing = computed(() => axisSizingForNode(editor.graph, node.value, 'width'))
  const heightSizing = computed(() => axisSizingForNode(editor.graph, node.value, 'height'))

  function sizingOptions() {
    return sizingOptionsForNode(editor.graph, node.value, {
      FIXED: panels.value.sizingFixed,
      HUG: panels.value.sizingHug,
      FILL: panels.value.sizingFill
    })
  }

  const widthSizingOptions = computed(sizingOptions)
  const heightSizingOptions = computed(sizingOptions)

  return {
    isInAutoLayout,
    isGrid,
    isFlex,
    widthSizing,
    heightSizing,
    widthSizingOptions,
    heightSizingOptions
  }
}
