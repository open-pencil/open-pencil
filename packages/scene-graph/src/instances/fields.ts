import type { SceneNode } from '../'

export const INSTANCE_SYNC_TEXT_PROPS = [
  'name',
  'text',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'italic',
  'textDirection',
  'letterSpacing',
  'lineHeight',
  'textCase',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textUnderlineOffset',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textAlignHorizontal',
  'textAlignVertical',
  'textAutoResize',
  'textTruncation',
  'maxLines',
  'leadingTrim',
  'paragraphSpacing',
  'paragraphIndent',
  'listSpacing',
  'hangingList',
  'fontVariations',
  'fontFeatures',
  // Styled ranges belong to the characters: an instance that overrides its text keeps them.
  'styleRuns',
  'textParagraphs'
] as const

/** Fields that belong to another one: overriding the owner keeps them too. */
export const INSTANCE_SYNC_FIELD_OWNERS: Readonly<Partial<Record<string, string>>> = {
  styleRuns: 'text',
  textParagraphs: 'text'
}

export const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = [
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'targetAspectRatio',
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
  'itemReverseZIndex',
  'strokesIncludedInLayout',
  'layoutGrids',
  'blendMode',
  'cornerSmoothing',
  'strokeWeight',
  'strokeAlign',
  'strokeCap',
  'strokeJoin',
  'strokeMiterLimit',
  'dashPattern',
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

/** How a layer inside an instance sits in its parent and whether it is locked, which its overrides may change. */
export const INSTANCE_SYNC_CHILD_PROPS = ['layoutGrow', 'layoutAlignSelf', 'locked'] as const

/**
 * Where a component's layer sits and how it is shaped, which Figma refuses to override in an
 * instance ("This property cannot be overridden in an instance"), so its copies always follow.
 * A layer in an auto layout flow takes its position from the layout instead.
 */
export const INSTANCE_FOLLOWED_FIELDS = [
  'x',
  'y',
  'rotation',
  'flipX',
  'flipY',
  'horizontalConstraint',
  'verticalConstraint',
  'layoutPositioning',
  'counterAxisAlignContent',
  'isMask',
  'maskType',
  'arcData',
  'pointCount',
  'starInnerRadius',
  'shapeWithTextType',
  'shapeUserHeight',
  'shapeUserWidth'
] as const

/** Fields an edit to a layer inside an instance records as that instance's override. */
export const INSTANCE_OVERRIDE_FIELDS = [
  ...INSTANCE_SYNC_PROPS,
  ...INSTANCE_SYNC_TEXT_PROPS,
  ...INSTANCE_SYNC_CHILD_PROPS,
  'visible'
] as const

/** Fields a component's layer gives the copies of it in every instance. */
export const INSTANCE_SYNC_FIELDS = [
  ...INSTANCE_OVERRIDE_FIELDS,
  ...INSTANCE_FOLLOWED_FIELDS
] as const
