import type { SceneNode } from '../'

export const INSTANCE_SYNC_TEXT_PROPS = [
  'name',
  'text',
  'fontSize',
  'fontWeight',
  'fontFamily',
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
  'effects',
  'opacity',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomRightRadius',
  'bottomLeftRadius',
  'independentCorners',
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
