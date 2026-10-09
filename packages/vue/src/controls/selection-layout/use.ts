import { computed } from 'vue'

import type { LayoutMode, NodeType, SceneNode } from '@open-pencil/scene-graph'

import { MIXED, useNodeProps, type MixedValue } from '#vue/controls/node-props/use'
import { useEditor } from '#vue/editor/context'

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
 * flow when every layer can hold an auto layout, and clip content for those that can clip. Each
 * edit changes the layers it applies to in one undo step.
 */
export function useSelectionLayout() {
  const editor = useEditor()
  const { nodes } = useNodeProps()

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
    setTextResize,
    setLayoutMode,
    toggleClipsContent
  }
}
