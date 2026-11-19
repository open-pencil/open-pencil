import type { SceneNode, TextAutoResize } from '../types'

/** A text's resizing as Figma's plugin API names it, where `TRUNCATE` is a fixed box that truncates. */
export type FigmaTextAutoResize = TextAutoResize | 'TRUNCATE'

type TextResizeFields = Pick<SceneNode, 'textAutoResize' | 'textTruncation' | 'maxLines'>

/** The resizing Figma's plugin API reads for a text: a fixed box that truncates reads `TRUNCATE`. */
export function figmaTextAutoResize(
  node: Pick<SceneNode, 'textAutoResize' | 'textTruncation'>
): FigmaTextAutoResize {
  return node.textAutoResize === 'NONE' && node.textTruncation === 'ENDING'
    ? 'TRUNCATE'
    : node.textAutoResize
}

/**
 * The fields setting a resizing writes, as Figma's setter does: `TRUNCATE` fixes the box and
 * truncates its end with no line limit, and any other mode stops truncating.
 */
export function textAutoResizeFields(mode: FigmaTextAutoResize): Partial<TextResizeFields> {
  return mode === 'TRUNCATE'
    ? { textAutoResize: 'NONE', textTruncation: 'ENDING', maxLines: null }
    : { textAutoResize: mode, textTruncation: 'DISABLED' }
}
