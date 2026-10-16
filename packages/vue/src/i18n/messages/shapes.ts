import { i18n } from '#vue/i18n/create'

/** Names of FigJam's shape-with-text kinds, and of the picker that switches between them. */
export const shapeMessageDefaults = {
  kind: 'Shape',
  square: 'Square',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
  triangleUp: 'Triangle',
  triangleDown: 'Triangle down',
  roundedRectangle: 'Rounded rectangle',
  parallelogramRight: 'Parallelogram',
  parallelogramLeft: 'Parallelogram left',
  engDatabase: 'Database',
  engQueue: 'Queue',
  engFile: 'File',
  engFolder: 'Folder',
  trapezoid: 'Trapezoid',
  predefinedProcess: 'Predefined process',
  shield: 'Shield',
  documentSingle: 'Document',
  documentMultiple: 'Documents',
  manualInput: 'Manual input',
  hexagon: 'Hexagon',
  chevron: 'Chevron',
  pentagon: 'Pentagon',
  octagon: 'Octagon',
  star: 'Star',
  plus: 'Plus',
  arrowLeft: 'Arrow left',
  arrowRight: 'Arrow right',
  summingJunction: 'Summing junction',
  or: 'Or',
  speechBubble: 'Speech bubble',
  internalStorage: 'Internal storage'
} as const

export const shapeMessages = i18n('shapes', shapeMessageDefaults)
