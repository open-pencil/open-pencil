import { difference } from 'es-toolkit/array'

import { CORNER_FIELDS, PAINT_FIELDS, STROKE_FIELDS } from '../fields/appearance'
import { SIZE_FIELDS, TRANSFORM_FIELDS } from '../fields/geometry'
import { AUTO_LAYOUT_FIELDS, SIZE_CONSTRAINT_FIELDS } from '../fields/layout'
import { TEXT_STYLE_FIELDS } from '../fields/text'
import { STYLE_LINK_FIELDS } from '../shared-styles'
import type { SceneNode } from '../types'

export const INSTANCE_SYNC_TEXT_PROPS = [
  'name',
  'text',
  ...TEXT_STYLE_FIELDS,
  'textDirection',
  'textAutoResize',
  'textTruncation',
  'maxLines',
  'leadingTrim',
  'listSpacing',
  'hangingList',
  // Styled ranges belong to the characters: an instance that overrides its text keeps them.
  'styleRuns',
  'textParagraphs'
] as const

/** Fields that belong to another one: overriding the owner keeps them too. */
export const INSTANCE_SYNC_FIELD_OWNERS: Readonly<Partial<Record<string, string>>> = {
  fillStyleId: 'fills',
  styleRuns: 'text',
  textParagraphs: 'text'
}

/**
 * Where a component's layer sits and how it is shaped, which Figma refuses to override in an
 * instance ("This property cannot be overridden in an instance"), so its copies always follow.
 * A layer in an auto layout flow takes its position from the layout instead.
 */
export const INSTANCE_FOLLOWED_FIELDS = [
  ...TRANSFORM_FIELDS,
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
  'shapeTruncates'
] as const

/** Fields a component's layer gives its copies unless an instance overrides them. */
export const INSTANCE_SYNC_PROPS: (keyof SceneNode)[] = difference(
  [
    ...SIZE_FIELDS,
    ...SIZE_CONSTRAINT_FIELDS,
    ...PAINT_FIELDS,
    ...STROKE_FIELDS,
    ...CORNER_FIELDS,
    ...AUTO_LAYOUT_FIELDS,
    'itemReverseZIndex',
    'gridPosition',
    'clipsContent',
    'layoutGrids',
    'boundVariables',
    'variableModes',
    // Applied shared styles follow the component unless an instance overrides them.
    ...STYLE_LINK_FIELDS
  ],
  INSTANCE_FOLLOWED_FIELDS
)

/** How a layer inside an instance sits in its parent and whether it is locked, which its overrides may change. */
export const INSTANCE_SYNC_CHILD_PROPS = ['layoutGrow', 'layoutAlignSelf', 'locked'] as const

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
