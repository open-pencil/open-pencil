import type { SceneNode } from '@open-pencil/scene-graph'

/** Paragraph construction is typed against this list, which also drives cache invalidation. */
export const PARAGRAPH_INPUT_KEYS = [
  'text',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'styleRuns',
  'fontVariations',
  'fontFeatures',
  'textLanguage',
  'textDirection',
  'textCase',
  'letterSpacing',
  'lineHeight',
  'textAlignHorizontal',
  'leadingTrim',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textTruncation',
  'maxLines',
  'textAutoResize',
  'width',
  'height'
] as const satisfies readonly (keyof SceneNode)[]

export type ParagraphNode = Pick<SceneNode, (typeof PARAGRAPH_INPUT_KEYS)[number]>
