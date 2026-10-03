import type { SceneNode } from '../types'

/** Fields shared by shaping, paragraph measurement, and auto-width invalidation. */
export const TEXT_METRIC_FIELDS = [
  'text',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'italic',
  'letterSpacing',
  'styleRuns',
  'fontVariations',
  'fontFeatures'
] as const satisfies readonly (keyof SceneNode)[]

export const TEXT_SHAPING_FIELDS = [
  ...TEXT_METRIC_FIELDS,
  'lineHeight',
  'textCase',
  'textDirection',
  'textAlignHorizontal',
  'textAlignVertical'
] as const satisfies readonly (keyof SceneNode)[]

export const TEXT_LAYOUT_FIELDS = [
  'width',
  'height',
  'textAutoResize',
  'maxLines'
] as const satisfies readonly (keyof SceneNode)[]
