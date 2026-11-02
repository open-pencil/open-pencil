import type { DerivedTextGlyph, SceneNode } from '@open-pencil/scene-graph'

/**
 * The font the editor's text layout falls back to for emoji: Noto Color Emoji's characters and
 * sequences with every emoji 1 em wide, as Figma lays them out, and no outlines. Built by
 * `tools/generate/emoji-metrics`; the emoji themselves are drawn over it.
 */
export const EMOJI_METRICS_FAMILY = 'OpenPencil Emoji Metrics'

/** The colour emoji font that draws emoji where the platform cannot. */
export const NOTO_COLOR_EMOJI_FAMILY = 'Noto Color Emoji'

/** The characters a saved emoji glyph stands for. */
export function emojiText(glyph: Pick<DerivedTextGlyph, 'emojiCodePoints'>): string {
  return glyph.emojiCodePoints ? String.fromCodePoint(...glyph.emojiCodePoints) : ''
}

/** Whether the platform draws emoji itself: a browser does, through its 2D canvas. */
export function canDrawPlatformEmoji(): boolean {
  return typeof OffscreenCanvas !== 'undefined'
}

const POSSIBLE_EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u

/** Whether text has a character that may be drawn as an emoji, to skip looking for them. */
export function mayHoldEmoji(text: string): boolean {
  return POSSIBLE_EMOJI.test(text)
}

/** The emoji a text's saved glyphs draw, as characters, for loading a font that has them. */
export function savedEmojiCharacters(node: SceneNode): string {
  let characters = ''
  for (const glyph of node.derivedTextGlyphs ?? []) characters += emojiText(glyph)
  return characters
}
