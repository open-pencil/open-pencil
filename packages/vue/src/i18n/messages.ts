import { params } from '@nanostores/i18n'

import { i18n } from './i18n'

export const menuMessages = i18n('menu', {
  file: 'File',
  edit: 'Edit',
  view: 'View',
  object: 'Object',
  arrange: 'Arrange',
  text: 'Text',

  new: 'New',
  open: 'Open…',
  save: 'Save',
  saveAs: 'Save as…',
  exportSelection: 'Export selection…',
  autosave: 'Auto-save to local file',

  copy: 'Copy',
  paste: 'Paste',

  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  profiler: 'Performance profiler',

  moveToPage: 'Move to page',
  createInstance: 'Create instance',

  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline'
})

export const commandMessages = i18n('commands', {
  undo: 'Undo',
  redo: 'Redo',
  selectAll: 'Select all',
  duplicate: 'Duplicate',
  delete: 'Delete',
  group: 'Group',
  ungroup: 'Ungroup',
  createComponent: 'Create component',
  createComponentSet: 'Create component set',
  createInstance: 'Create instance',
  detachInstance: 'Detach instance',
  goToMainComponent: 'Go to main component',
  addAutoLayout: 'Add auto layout',
  bringToFront: 'Bring to front',
  sendToBack: 'Send to back',
  toggleVisibility: 'Toggle visibility',
  toggleLock: 'Toggle lock',
  moveToPage: 'Move to page',
  zoomTo100: 'Zoom to 100%',
  zoomToFit: 'Zoom to fit',
  zoomToSelection: 'Zoom to selection'
})

export const toolMessages = i18n('tools', {
  move: 'Move',
  frame: 'Frame',
  section: 'Section',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  polygon: 'Polygon',
  star: 'Star',
  pen: 'Pen',
  text: 'Text',
  hand: 'Hand'
})

export const panelMessages = i18n('panels', {
  layers: 'Layers',
  design: 'Design',
  code: 'Code',
  assets: 'Assets',

  position: 'Position',
  layout: 'Layout',
  appearance: 'Appearance',
  fill: 'Fill',
  stroke: 'Stroke',
  effects: 'Effects',
  export: 'Export',
  typography: 'Typography',
  variables: 'Variables',
  constraints: 'Constraints',

  addFill: 'Add fill',
  addStroke: 'Add stroke',
  addEffect: 'Add effect',
  addExport: 'Add export',

  dropShadow: 'Drop shadow',
  innerShadow: 'Inner shadow',
  layerBlur: 'Layer blur',
  backgroundBlur: 'Background blur',

  noSelection: 'No selection',
  mixed: 'Mixed',

  solid: 'Solid',
  linearGradient: 'Linear',
  radialGradient: 'Radial',
  image: 'Image',

  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignTop: 'Align top',
  alignMiddle: 'Align middle',
  alignBottom: 'Align bottom'
})

export const pageMessages = i18n('pages', {
  newPage: 'New page',
  rename: 'Rename',
  delete: 'Delete',
  pageName: params('Page {number}')
})

export const dialogMessages = i18n('dialogs', {
  cancel: 'Cancel',
  apply: 'Apply',
  close: 'Close',
  ok: 'OK',
  search: 'Search…',
  noResults: 'No results'
})
