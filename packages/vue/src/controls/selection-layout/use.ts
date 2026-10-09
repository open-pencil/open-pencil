import { computed } from 'vue'

import type { LayoutMode, NodeType, SceneNode } from '@open-pencil/scene-graph'

import { MIXED, useNodeProps, type MixedValue } from '#vue/controls/node-props/use'
import { useUndoBatch } from '#vue/controls/undo-batch/use'
import { useEditor } from '#vue/editor/context'
import { useSceneComputed } from '#vue/internal/scene-computed/use'

/** Layers that can hold an auto layout and clip their content. */
export const LAYOUT_CONTAINER_TYPES: ReadonlySet<NodeType> = new Set<NodeType>([
  'FRAME',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE'
])

export type TextResizeMode = 'AUTO_WIDTH' | 'AUTO_HEIGHT' | 'FIXED'

const TEXT_AUTO_RESIZE: Record<TextResizeMode, SceneNode['textAutoResize']> = {
  AUTO_WIDTH: 'WIDTH_AND_HEIGHT',
  AUTO_HEIGHT: 'HEIGHT',
  FIXED: 'NONE'
}

export function textResizeMode(node: SceneNode): TextResizeMode {
  if (node.textAutoResize === 'WIDTH_AND_HEIGHT') return 'AUTO_WIDTH'
  if (node.textAutoResize === 'HEIGHT' || node.textAutoResize === 'TRUNCATE') return 'AUTO_HEIGHT'
  return 'FIXED'
}

function shared<T>(values: readonly T[]): MixedValue<T> | undefined {
  if (values.length === 0) return undefined
  const [first] = values
  return values.every((value) => value === first) ? first : MIXED
}

/**
 * Layout of a multi-selection, as Figma's panel shows it: text resizing for its text layers,
 * flow when every layer can hold an auto layout, clip content for those that can clip, and the
 * spacing of a row or column. Each edit changes the layers it applies to in one undo step.
 */
export function useSelectionLayout() {
  const editor = useEditor()
  const { nodes } = useNodeProps()
  const batch = useUndoBatch(editor.undo, editor.beginInteractiveEdit)

  const texts = computed(() => nodes.value.filter((node) => node.type === 'TEXT'))
  const containers = computed(() =>
    nodes.value.filter((node) => LAYOUT_CONTAINER_TYPES.has(node.type))
  )
  const allContainers = computed(
    () => nodes.value.length > 0 && containers.value.length === nodes.value.length
  )

  /** Undefined when no text is selected. */
  const textResize = computed(() => shared(texts.value.map(textResizeMode)))
  /** Undefined unless every selected layer can hold an auto layout. */
  const layoutMode = computed(() =>
    allContainers.value ? shared(containers.value.map((node) => node.layoutMode)) : undefined
  )
  const rowSpacing = useSceneComputed(() =>
    editor.selectionSpacing(nodes.value.map((node) => node.id))
  )
  /** The axis of a row or column, or undefined when the layers are not one. */
  const spacingAxis = computed(() => rowSpacing.value?.axis)
  /** The gap between neighbours, MIXED when they differ. */
  const spacing = computed<MixedValue<number>>(() => {
    const gaps = rowSpacing.value?.gaps.map((gap) => Math.round(gap * 100) / 100) ?? []
    return shared(gaps) ?? MIXED
  })

  /** Spaces the row evenly from its first layer; a scrub is one undo step. */
  function setSpacing(gap: number) {
    batch.ensure('selection-spacing', 'Change spacing')
    editor.setSelectionSpacing(
      nodes.value.map((node) => node.id),
      gap
    )
  }

  /** Undefined when nothing selected can clip. */
  const clipsContent = computed(() => shared(containers.value.map((node) => node.clipsContent)))

  function setTextResize(mode: TextResizeMode) {
    editor.undo.runBatch('Set text resizing', () => {
      for (const node of texts.value)
        editor.updateNodeWithUndo(node.id, { textAutoResize: TEXT_AUTO_RESIZE[mode] })
    })
  }

  function setLayoutMode(mode: LayoutMode) {
    editor.undo.runBatch('Set layout', () => {
      for (const node of containers.value) editor.setLayoutMode(node.id, mode)
    })
  }

  /** A mixed checkbox turns clipping on, as Figma's does. */
  function toggleClipsContent() {
    const clips = clipsContent.value !== true
    editor.undo.runBatch('Toggle clip content', () => {
      for (const node of containers.value)
        editor.updateNodeWithUndo(node.id, { clipsContent: clips })
    })
  }

  return {
    editor,
    nodes,
    texts,
    containers,
    textResize,
    layoutMode,
    clipsContent,
    spacingAxis,
    spacing,
    setSpacing,
    flushSpacing: batch.flush,
    setTextResize,
    setLayoutMode,
    toggleClipsContent
  }
}
