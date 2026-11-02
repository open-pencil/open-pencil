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
  'opticalSizeFromFontSize',
  'fontFeatures',
  'textParagraphs',
  'listSpacing',
  'paragraphSpacing',
  'paragraphIndent',
  'hangingList'
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

export const TEXT_DECORATION_FIELDS = [
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textUnderlineOffset',
  'textDecorationFills',
  'textDecorationSkipInk'
] as const satisfies readonly (keyof SceneNode)[]

/** How text is styled, apart from its content and how its box sizes. */
export const TEXT_STYLE_FIELDS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'lineHeight',
  'letterSpacing',
  'paragraphSpacing',
  'paragraphIndent',
  'textAlignHorizontal',
  'textAlignVertical',
  'textCase',
  ...TEXT_DECORATION_FIELDS,
  'fontFeatures',
  'fontVariations',
  'opticalSizeFromFontSize'
] as const satisfies readonly (keyof SceneNode)[]
