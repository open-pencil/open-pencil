import { computed } from 'vue'

import type { MaskType } from '@open-pencil/scene-graph'

import { useEditor } from '#vue/editor/context'
import { useSelectionState } from '#vue/editor/selection-state/use'

/** Headless state and actions for the selected mask node. */
export function useMask() {
  const editor = useEditor()
  const { selectedNode } = useSelectionState()

  const active = computed(() => selectedNode.value?.isMask === true)
  const maskType = computed(() => selectedNode.value?.maskType ?? 'ALPHA')

  function setMaskType(value: MaskType) {
    const node = selectedNode.value
    if (!node?.isMask || node.maskType === value) return
    editor.updateNodeWithUndo(node.id, { maskType: value }, 'Change mask type')
  }

  return { active, maskType, setMaskType }
}
