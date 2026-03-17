import { onScopeDispose, ref, watchEffect, type Ref } from 'vue'
import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  attachInstruction,
  extractInstruction,
  type Instruction,
  type ItemMode
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'

import type { Editor } from '@open-pencil/core/editor'

interface DragItem {
  id: string
  level: number
  hasChildren: boolean
  parentId: string | null
}

type TreeInstruction = Extract<
  Instruction,
  { type: 'reorder-above' | 'reorder-below' | 'make-child' }
>

export function useLayerDrag(
  editor: Editor,
  indentPerLevel = 16
) {
  const draggingId = ref<string | null>(null)
  const instruction = ref<TreeInstruction | null>(null)
  const instructionTargetId = ref<string | null>(null)

  function setupItem(
    el: Ref<HTMLElement | null>,
    item: () => DragItem
  ) {
    watchEffect((onCleanup) => {
      const element = el.value
      if (!element) return

      const data = item()

      const mode: ItemMode = data.hasChildren
        ? 'expanded'
        : 'standard'

      const cleanup = combine(
        draggable({
          element,
          getInitialData: () => ({ id: data.id }),
          onDragStart: () => { draggingId.value = data.id },
          onDrop: () => { draggingId.value = null }
        }),
        dropTargetForElements({
          element,
          getData: ({ input, element: el }) =>
            attachInstruction({ id: data.id }, {
              input,
              element: el,
              indentPerLevel,
              currentLevel: data.level,
              mode,
              block: []
            }),
          canDrop: ({ source }) => source.data.id !== data.id,
          onDrag: ({ self }) => {
            const inst = extractInstruction(self.data) as TreeInstruction | null
            instruction.value = inst
            instructionTargetId.value = inst ? data.id : null
          },
          onDragLeave: () => {
            instruction.value = null
            instructionTargetId.value = null
          },
          onDrop: () => {
            instruction.value = null
            instructionTargetId.value = null
          },
          getIsSticky: () => true
        })
      )

      onCleanup(cleanup)
    })
  }

  const cleanupMonitor = monitorForElements({
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets[0]
      if (!target) return

      const sourceId = source.data.id as string
      const targetId = target.data.id as string
      const inst = extractInstruction(target.data) as TreeInstruction | null
      if (!inst || !sourceId || !targetId) return

      if (editor.graph.isDescendant(targetId, sourceId)) return

      const targetNode = editor.graph.getNode(targetId)
      if (!targetNode) return
      const targetParentId = targetNode.parentId ?? editor.state.currentPageId
      const targetParent = editor.graph.getNode(targetParentId)
      if (!targetParent) return
      const targetIndex = targetParent.childIds.indexOf(targetId)

      if (inst.type === 'reorder-above') {
        editor.reorderChildWithUndo(sourceId, targetParentId, targetIndex)
      } else if (inst.type === 'reorder-below') {
        editor.reorderChildWithUndo(sourceId, targetParentId, targetIndex + 1)
      } else if (inst.type === 'make-child') {
        const container = editor.graph.getNode(targetId)
        editor.reorderChildWithUndo(sourceId, targetId, container?.childIds.length ?? 0)
      }

      draggingId.value = null
      instruction.value = null
      instructionTargetId.value = null
    }
  })
  onScopeDispose(cleanupMonitor)

  return {
    draggingId,
    instruction,
    instructionTargetId,
    setupItem
  }
}
