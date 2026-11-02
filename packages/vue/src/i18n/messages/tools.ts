import { i18n } from '#vue/i18n/create'

export const toolMessageDefaults = {
  move: 'Move',
  frame: 'Frame',
  section: 'Section',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  polygon: 'Polygon',
  star: 'Star',
  pen: 'Pen',
  pencil: 'Pencil',
  text: 'Text',
  sticky: 'Sticky note',
  shape: 'Shape',
  connector: 'Connector',
  hand: 'Hand',
  comment: 'Comment'
} as const

export const toolMessages = i18n('tools', toolMessageDefaults)
