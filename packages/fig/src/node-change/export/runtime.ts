import type { DerivedTextGlyph, SceneNode } from '@open-pencil/scene-graph'

import type { ShapedText } from '../derived-text/build'
import { standardStyleNamer, type StyleNamer } from '../font/style'
import type { OutlineCommand } from '../path/commands'

/**
 * A glyph where it stands, as saved and shaped glyphs both give it, with its outline: saved
 * glyphs keep it as command bytes, shaped ones as commands, or none when unknown.
 */
export type PlacedTextGlyph = Pick<
  DerivedTextGlyph,
  'x' | 'y' | 'firstCharacter' | 'advance' | 'fontSize' | 'scaleX' | 'scaleY'
> & { commandsBlob?: Uint8Array; commands?: OutlineCommand[] | null }

/** One underline or strikethrough on one line, by the first character it decorates. */
export interface TextDecorationRecord {
  firstCharacter: number
  x: number
  y: number
  width: number
  height: number
}

/** Engine services the `.fig` writer needs but cannot provide without a text shaper. */
export interface FigNodeChangeExportRuntime {
  /** Lay the node's text out at its width as the renderer draws it, or `null` when it cannot. */
  shapeText(node: SceneNode): ShapedText | null
  /** The node's underlines and strikethroughs over these glyphs, as Figma saves them. */
  textDecorations(node: SceneNode, glyphs: readonly PlacedTextGlyph[]): TextDecorationRecord[]
  /** The name a family's font gives its face at a weight and slant, which Figma finds it by. */
  fontStyleName: StyleNamer
}

export const EMPTY_EXPORT_RUNTIME: FigNodeChangeExportRuntime = {
  shapeText: () => null,
  textDecorations: () => [],
  fontStyleName: standardStyleNamer
}
