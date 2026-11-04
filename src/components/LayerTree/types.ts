import type { LayerDragInstruction } from '@open-pencil/vue/primitives/LayerTree'

export interface LayerTreeItemActions {
  select: (additive: boolean) => void
  toggleExpand: () => void
  toggleVisibility: () => void
  toggleLock: () => void
  rename: (name: string) => void
}

export interface LayerTreeChrome {
  draggingId: string | null
  instruction: LayerDragInstruction | null
  instructionTargetId: string | null
  focused: boolean
  indent: number
}

export interface LayerRenameControls {
  commit: (id: string, event: Event) => void
  onKeydown: (event: KeyboardEvent) => void
  focusInput: (input: HTMLInputElement) => Promise<void>
}
