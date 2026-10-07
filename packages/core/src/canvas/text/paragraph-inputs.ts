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

const BOX_SIZE_KEYS = new Set<keyof SceneNode>(['width', 'height'])

/**
 * The paragraph inputs that decide how text shapes: which glyphs it needs and how big it is at a
 * given layout width. The box size only matters when the text is truncated, since it decides
 * which characters are shown; otherwise layout resizing the box leaves both as they were.
 */
export function shapingInputs(node: ParagraphNode): ParagraphNode[keyof ParagraphNode][] {
  const truncated = node.textTruncation === 'ENDING'
  return PARAGRAPH_INPUT_KEYS.filter((key) => truncated || !BOX_SIZE_KEYS.has(key)).map(
    (key) => node[key]
  )
}

/** Whether a change to `keys` can change shaping beyond what `shapingInputs` sees. */
export function changesShaping(keys: readonly (keyof SceneNode)[]): boolean {
  return keys.some(
    (key) => !BOX_SIZE_KEYS.has(key) && (PARAGRAPH_INPUT_KEYS as readonly string[]).includes(key)
  )
}
