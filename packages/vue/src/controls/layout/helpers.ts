import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type {
  GridTrack,
  LayoutAlign,
  LayoutCounterAlign,
  LayoutSizing,
  SceneNode
} from '@open-pencil/core/scene-graph'

import type { useI18n } from '#vue/i18n'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

export type AlignCell = { primary: LayoutAlign; counter: LayoutCounterAlign }

type GridTrackProp = 'gridTemplateColumns' | 'gridTemplateRows'

type LayoutPanelStrings = {
  sizingFixed: string
  sizingHug: string
  sizingFill: string
}

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
  const node = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)
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
    editor.updateNode(node.value.id, { paddingLeft: v, paddingRight: v })
  }

  function commitHorizontalPadding(_value: number, previous: number) {
    if (!node.value) return
    editor.commitNodeUpdate(
      node.value.id,
      { paddingLeft: previous, paddingRight: previous } satisfies Partial<SceneNode>,
      'Change horizontal padding'
    )
  }

  function setVerticalPadding(v: number) {
    if (!node.value) return
    editor.updateNode(node.value.id, { paddingTop: v, paddingBottom: v })
  }

  function commitVerticalPadding(_value: number, previous: number) {
    if (!node.value) return
    editor.commitNodeUpdate(
      node.value.id,
      { paddingTop: previous, paddingBottom: previous } satisfies Partial<SceneNode>,
      'Change vertical padding'
    )
  }

  function toggleIndividualPadding() {
    showIndividualPadding.value = !showIndividualPadding.value
  }

  return {
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

export function createLayoutActions({
  editor,
  node,
  isFlex,
  isInAutoLayout
}: {
  editor: Editor
  node: ComputedRef<SceneNode | null>
  isFlex: ComputedRef<boolean>
  isInAutoLayout: ComputedRef<boolean>
}) {
  function updateProp(key: string, value: number | string) {
    if (node.value) editor.updateNode(node.value.id, { [key]: value })
  }

  function updateSizeLimit(prop: SizeLimitProp, value: number) {
    if (!node.value) return
    editor.updateNode(node.value.id, { [prop]: value })
  }

  function setSizeLimitToCurrent(prop: SizeLimitProp) {
    const n = node.value
    if (!n) return
    const value = prop === 'minWidth' || prop === 'maxWidth' ? n.width : n.height
    editor.updateNodeWithUndo(n.id, { [prop]: Math.round(value) }, `Set ${prop}`)
  }

  function commitSizeLimit(prop: SizeLimitProp, _value: number, previous: number) {
    if (!node.value) return
    editor.commitNodeUpdate(node.value.id, { [prop]: previous }, `Change ${prop}`)
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

  function commitProp(key: string, _value: number | string, previous: number | string) {
    if (node.value) {
      editor.commitNodeUpdate(
        node.value.id,
        { [key]: previous } as Partial<SceneNode>,
        `Change ${key}`
      )
    }
  }

  function setWidthSizing(sizing: LayoutSizing) {
    const n = node.value
    if (!n) return
    if (isFlex.value) {
      const key = n.layoutMode === 'HORIZONTAL' ? 'primaryAxisSizing' : 'counterAxisSizing'
      updateProp(key, sizing)
    } else if (sizing === 'HUG' && n.childIds.length > 0) {
      updateProp('counterAxisSizing', 'HUG')
    } else {
      if (n.counterAxisSizing === 'HUG') updateProp('counterAxisSizing', 'FIXED')
      if (isInAutoLayout.value) updateProp('layoutGrow', sizing === 'FILL' ? 1 : 0)
    }
  }

  function setHeightSizing(sizing: LayoutSizing) {
    const n = node.value
    if (!n) return
    if (isFlex.value) {
      const key = n.layoutMode === 'VERTICAL' ? 'primaryAxisSizing' : 'counterAxisSizing'
      updateProp(key, sizing)
    } else if (sizing === 'HUG' && n.childIds.length > 0) {
      updateProp('primaryAxisSizing', 'HUG')
    } else {
      if (n.primaryAxisSizing === 'HUG') updateProp('primaryAxisSizing', 'FIXED')
      if (isInAutoLayout.value) updateProp('layoutAlignSelf', sizing === 'FILL' ? 'STRETCH' : 'AUTO')
    }
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
    updateProp,
    updateSizeLimit,
    setSizeLimitToCurrent,
    commitSizeLimit,
    addSizeLimit,
    removeSizeLimit,
    commitProp,
    setWidthSizing,
    setHeightSizing,
    setAlignment,
    setGapAuto,
    setLayoutDirection
  }
}

export function canNodeHugContents(node: SceneNode | null): boolean {
  return !!node && node.childIds.length > 0
}

export function widthSizingForNode(node: SceneNode | null, isInAutoLayout: boolean): LayoutSizing {
  if (!node) return 'FIXED'
  if (node.layoutMode === 'HORIZONTAL') return node.primaryAxisSizing
  if (node.layoutMode === 'VERTICAL') return node.counterAxisSizing
  if (canNodeHugContents(node) && node.counterAxisSizing === 'HUG') return 'HUG'
  if (isInAutoLayout && node.layoutGrow > 0) return 'FILL'
  return 'FIXED'
}

export function heightSizingForNode(node: SceneNode | null, isInAutoLayout: boolean): LayoutSizing {
  if (!node) return 'FIXED'
  if (node.layoutMode === 'VERTICAL') return node.primaryAxisSizing
  if (node.layoutMode === 'HORIZONTAL') return node.counterAxisSizing
  if (canNodeHugContents(node) && node.primaryAxisSizing === 'HUG') return 'HUG'
  if (isInAutoLayout && node.layoutAlignSelf === 'STRETCH') return 'FILL'
  return 'FIXED'
}

export function sizingOptionsForNode(
  node: SceneNode | null,
  isInAutoLayout: boolean,
  labels: Partial<Record<LayoutSizing, string>> = {}
): { value: LayoutSizing; label: string }[] {
  const isFlex = node?.layoutMode === 'HORIZONTAL' || node?.layoutMode === 'VERTICAL'
  const options: { value: LayoutSizing; label: string }[] = [
    { value: 'FIXED', label: labels.FIXED ?? 'Fixed' }
  ]
  if (isFlex || canNodeHugContents(node)) options.push({ value: 'HUG', label: labels.HUG ?? 'Hug' })
  if (isInAutoLayout || isFlex) options.push({ value: 'FILL', label: labels.FILL ?? 'Fill' })
  return options
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
  const widthSizing = computed<LayoutSizing>(() =>
    widthSizingForNode(node.value, isInAutoLayout.value)
  )

  const heightSizing = computed<LayoutSizing>(() =>
    heightSizingForNode(node.value, isInAutoLayout.value)
  )

  function sizingOptions() {
    return sizingOptionsForNode(node.value, isInAutoLayout.value, {
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
