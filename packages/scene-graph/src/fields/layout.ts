import type { SceneNode } from '../types'
import { SIZE_FIELDS, TRANSFORM_FIELDS } from './geometry'

/** How a frame lays out its children: auto layout and its grid tracks. */
export const AUTO_LAYOUT_FIELDS = [
  'layoutMode',
  'layoutDirection',
  'layoutWrap',
  'primaryAxisAlign',
  'counterAxisAlign',
  'counterAxisAlignContent',
  'primaryAxisSizing',
  'counterAxisSizing',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'strokesIncludedInLayout',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gridColumnGap',
  'gridRowGap'
] as const satisfies readonly (keyof SceneNode)[]

/** Size limits a layer keeps however it is resized. */
export const SIZE_CONSTRAINT_FIELDS = [
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'targetAspectRatio'
] as const satisfies readonly (keyof SceneNode)[]

/** Fields whose change moves a layer or its children, so cached absolute positions go stale. */
export const LAYOUT_AFFECTING_KEYS: ReadonlySet<string> = new Set([
  ...TRANSFORM_FIELDS,
  ...SIZE_FIELDS,
  ...AUTO_LAYOUT_FIELDS,
  'layoutPositioning',
  'layoutGrow',
  'layoutAlignSelf',
  'horizontalConstraint',
  'verticalConstraint',
  'gridPosition',
  ...SIZE_CONSTRAINT_FIELDS
])
