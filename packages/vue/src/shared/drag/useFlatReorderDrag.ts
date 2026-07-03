import {
  attachInstruction,
  extractInstruction,
  type Instruction
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/list-item'
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  draggable,
  dropTargetForElements,
  monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { onScopeDispose, ref } from 'vue'

export type FlatReorderAxis = 'vertical' | 'horizontal'
export type FlatReorderInstruction = Extract<
  Instruction,
  { operation: 'reorder-before' | 'reorder-after' }
>

export interface FlatReorderItem {
  id: string
}

export interface UseFlatReorderDragOptions<TItem extends FlatReorderItem> {
  items: () => readonly TItem[]
  onMove: (sourceId: string, targetIndex: number) => void
  axis?: FlatReorderAxis
  getId?: (item: TItem) => string
}

interface RegisteredItem {
  element: HTMLElement
  cleanup: () => void
}

function isFlatReorderInstruction(
  instruction: Instruction | null
): instruction is FlatReorderInstruction {
  return (
    !!instruction &&
    !instruction.blocked &&
    (instruction.operation === 'reorder-before' || instruction.operation === 'reorder-after')
  )
}

function edgeForInstruction(instruction: FlatReorderInstruction, axis: FlatReorderAxis) {
  if (axis === 'vertical') {
    return instruction.operation === 'reorder-before' ? 'top' : 'bottom'
  }
  return instruction.operation === 'reorder-before' ? 'left' : 'right'
}

export function useFlatReorderDrag<TItem extends FlatReorderItem>({
  items,
  onMove,
  axis = 'vertical',
  getId = (item) => item.id
}: UseFlatReorderDragOptions<TItem>) {
  const draggingId = ref<string | null>(null)
  const instruction = ref<FlatReorderInstruction | null>(null)
  const instructionTargetId = ref<string | null>(null)
  const registered = new Map<string, RegisteredItem>()

  function clearInstruction() {
    instruction.value = null
    instructionTargetId.value = null
  }

  function cleanupItem(id: string) {
    registered.get(id)?.cleanup()
    registered.delete(id)
  }

  function setupItem(element: HTMLElement | null, item: () => FlatReorderItem) {
    const { id } = item()
    const current = registered.get(id)
    if (current?.element === element) return

    cleanupItem(id)
    if (!element) return

    const cleanup = combine(
      draggable({
        element,
        getInitialData: () => ({ id }),
        onDragStart: () => {
          draggingId.value = id
        },
        onDrop: () => {
          draggingId.value = null
        }
      }),
      dropTargetForElements({
        element,
        getData: ({ input, element: target }) =>
          attachInstruction(
            { id },
            {
              input,
              element: target,
              axis,
              operations: {
                'reorder-before': 'available',
                'reorder-after': 'available'
              }
            }
          ),
        canDrop: ({ source }) => source.data.id !== id,
        onDrag: ({ self }) => {
          const nextInstruction = extractInstruction(self.data)
          if (!isFlatReorderInstruction(nextInstruction)) {
            clearInstruction()
            return
          }
          instruction.value = nextInstruction
          instructionTargetId.value = id
        },
        onDragLeave: clearInstruction,
        onDrop: clearInstruction,
        getIsSticky: () => true
      })
    )

    registered.set(id, { element, cleanup })
  }

  const cleanupMonitor = monitorForElements({
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets.at(0)
      if (!target) return

      const sourceId = typeof source.data.id === 'string' ? source.data.id : null
      const targetId = typeof target.data.id === 'string' ? target.data.id : null
      if (!sourceId || !targetId || sourceId === targetId) return

      const dropInstruction = extractInstruction(target.data)
      if (!isFlatReorderInstruction(dropInstruction)) return

      const currentItems = items()
      const startIndex = currentItems.findIndex((item) => getId(item) === sourceId)
      const indexOfTarget = currentItems.findIndex((item) => getId(item) === targetId)
      const targetIndex = getReorderDestinationIndex({
        startIndex,
        indexOfTarget,
        axis,
        closestEdgeOfTarget: edgeForInstruction(dropInstruction, axis)
      })

      if (targetIndex !== startIndex) onMove(sourceId, targetIndex)
      draggingId.value = null
      clearInstruction()
    }
  })

  onScopeDispose(() => {
    cleanupMonitor()
    for (const id of registered.keys()) cleanupItem(id)
  })

  return {
    draggingId,
    instruction,
    instructionTargetId,
    setupItem
  }
}
