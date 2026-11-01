import type { Component, ComputedRef } from 'vue'

export type EditorCommandId =
  | 'edit.undo'
  | 'edit.redo'
  | 'selection.selectAll'
  | 'selection.selectInverse'
  | 'selection.selectChildren'
  | 'selection.selectParent'
  | 'selection.selectNextSibling'
  | 'selection.selectPreviousSibling'
  | 'selection.duplicate'
  | 'selection.delete'
  | 'selection.group'
  | 'selection.frameSelection'
  | 'selection.wrapInSection'
  | 'selection.ungroup'
  | 'selection.createComponent'
  | 'selection.createComponentSet'
  | 'selection.createInstance'
  | 'selection.detachInstance'
  | 'selection.detachIcon'
  | 'selection.goToMainComponent'
  | 'selection.createSlot'
  | 'selection.wrapInAutoLayout'
  | 'selection.toggleMask'
  | 'selection.bringForward'
  | 'selection.bringToFront'
  | 'selection.sendBackward'
  | 'selection.sendToBack'
  | 'selection.toggleVisibility'
  | 'selection.toggleLock'
  | 'selection.flipHorizontal'
  | 'selection.flipVertical'
  | 'selection.distributeHorizontal'
  | 'selection.distributeVertical'
  | 'selection.tidyUp'
  | 'selection.packHorizontal'
  | 'selection.packVertical'
  | 'selection.arrangeSpread'
  | 'selection.arrangeCompact'
  | 'selection.arrangePack'
  | 'selection.arrangeFlowDown'
  | 'selection.arrangeFlowRight'
  | 'selection.arrangeTreeDown'
  | 'selection.arrangeTreeRight'
  | 'selection.arrangeRadial'
  | 'selection.arrangeNetwork'
  | 'selection.booleanUnion'
  | 'selection.booleanSubtract'
  | 'selection.booleanIntersect'
  | 'selection.booleanExclude'
  | 'selection.flatten'
  | 'selection.outlineText'
  | 'selection.outlineStroke'
  | 'selection.moveToPage'
  | 'selection.setOpacity'
  | 'view.zoom100'
  | 'view.zoomFit'
  | 'view.zoomSelection'
  | 'view.zoomNextFrame'
  | 'view.zoomPreviousFrame'
  | 'view.nextPage'
  | 'view.previousPage'

export interface EditorCommand {
  id: EditorCommandId
  label: string
  enabled: ComputedRef<boolean>
  run: () => void
}

export interface EditorCommandMenuItem {
  id?: EditorCommandId
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  icon?: Component
}

export interface EditorCommandMenuSeparator {
  separator: true
}

export type EditorCommandMenuEntry = EditorCommandMenuItem | EditorCommandMenuSeparator
