import { i18n } from '#vue/i18n/create'

export const menuMessageDefaults = {
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
  closeTab: 'Close tab',

  copy: 'Copy',
  paste: 'Paste',

  theme: 'Theme',
  themeLight: 'Light',
  themeDark: 'Dark',
  themeAuto: 'Auto',
  profiler: 'Performance profiler',
  language: 'Language',
  checkUpdates: 'Check for updates…',

  moveToPage: 'Move to page',
  createInstance: 'Create instance',
  hide: 'Hide',
  show: 'Show',
  lock: 'Lock',
  unlock: 'Unlock',
  cut: 'Cut',
  front: 'Front',
  back: 'Back',
  toggleUI: 'Toggle UI',

  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',

  pasteHere: 'Paste here',
  pasteToReplace: 'Paste to replace',
  copyPasteAs: 'Copy/Paste as',
  copyAsText: 'Copy as text',
  copyAsSVG: 'Copy as SVG',
  copyAsPNG: 'Copy as PNG',
  copyAsJSX: 'Copy as JSX',
  copyNodeId: 'Copy node ID',
  copyXPath: 'Copy XPath',
  convertToVector: 'Convert to Vector',
  booleanOperations: 'Boolean operations',
  arrangeAlignLeft: 'Align left',
  arrangeAlignCenter: 'Align center',
  arrangeAlignRight: 'Align right',
  arrangeAlignTop: 'Align top',
  arrangeAlignMiddle: 'Align middle',
  arrangeAlignBottom: 'Align bottom',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out'
} as const

export const menuMessages = i18n('menu', menuMessageDefaults)
