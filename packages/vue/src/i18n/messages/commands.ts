import { i18n } from '#vue/i18n/create'

export const commandMessageDefaults = {
  undo: 'Undo',
  redo: 'Redo',
  selectAll: 'Select all',
  duplicate: 'Duplicate',
  delete: 'Delete',
  group: 'Group',
  groupSelection: 'Group selection',
  frameSelection: 'Frame selection',
  ungroup: 'Ungroup',
  createComponent: 'Create component',
  createComponentSet: 'Create component set',
  createInstance: 'Create instance',
  detachInstance: 'Detach instance',
  goToMainComponent: 'Go to main component',
  addAutoLayout: 'Add auto layout',
  bringToFront: 'Bring to front',
  sendToBack: 'Send to back',
  showHide: 'Show/Hide',
  lockUnlock: 'Lock/Unlock',
  unionSelection: 'Union selection',
  subtractSelection: 'Subtract selection',
  intersectSelection: 'Intersect selection',
  excludeSelection: 'Exclude selection',
  flattenSelection: 'Flatten',
  outlineText: 'Outline text',
  outlineStroke: 'Outline stroke',
  booleanOperations: 'Boolean operations',
  flipHorizontal: 'Flip horizontal',
  flipVertical: 'Flip vertical',
  moveToPage: 'Move to page',
  zoomTo100: 'Zoom to 100%',
  zoomToFit: 'Zoom to fit',
  zoomToSelection: 'Zoom to selection'
} as const

export const commandMessages = i18n('commands', commandMessageDefaults)
