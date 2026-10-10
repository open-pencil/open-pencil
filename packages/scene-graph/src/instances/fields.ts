import type { SceneNode, Stroke } from '../'

/**
 * Fields an instance's layers take from their component layers but an instance itself does not
 * take from its component: names and locks, and text with its styling.
 */
export const INSTANCE_SYNC_TEXT_PROPS = [
  'name',
  'locked',
  'text',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'italic',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'textDecoration',
  'textAlignHorizontal',
  'textAlignVertical',
  'textDirection'
] as const

export const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'fills',
  'strokes',
  'strokeWeight',
  'strokeAlign',
  'strokeCap',
  'strokeJoin',
  'dashPattern',
  'effects',
  'opacity',
  'blendMode',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
  'cornerSmoothing',
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisAlign',
  'counterAxisAlign',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumnGap',
  'gridRowGap',
  'gridPosition',
  'clipsContent',
  'independentStrokeWeights',
  'borderTopWeight',
  'borderRightWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'boundVariables',
  'variableModes',
  // Applied shared styles follow the component unless an instance overrides them.
  'fillStyleId',
  'strokeStyleId',
  'textStyleId',
  'effectStyleId',
  'gridStyleId'
]

export const INSTANCE_SYNC_FIELDS = [
  ...INSTANCE_SYNC_PROPS,
  ...INSTANCE_SYNC_TEXT_PROPS,
  'visible'
] as const

/**
 * The parts of a stroke Figma keeps on the layer and overrides apart from the paint, with the
 * layer field each one is overridden as.
 */
export const STROKE_GEOMETRY_FIELDS = {
  weight: 'strokeWeight',
  align: 'strokeAlign',
  cap: 'strokeCap',
  join: 'strokeJoin',
  dashPattern: 'dashPattern'
} as const satisfies Partial<Record<keyof Stroke, keyof SceneNode>>
