import type { CanvasKit } from 'canvaskit-wasm'

import {
  EMPTY_EXPORT_RUNTIME,
  type FigNodeChangeExportRuntime,
  type PlacedTextGlyph,
  type TextDecorationRecord
} from '@open-pencil/fig/node-change'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { getCanvasKit } from '#core/canvaskit'
import { withTextShaper } from '#core/io/shaping'
import { textDecorationRects, type DecoratedGlyph } from '#core/text/decorations'
import { faceStyleName } from '#core/text/font/names'
import { outlineInk, savedGlyphInk } from '#core/text/ink'

function decoratedGlyph(glyph: PlacedTextGlyph): DecoratedGlyph {
  const { commandsBlob, commands } = glyph
  return {
    ...glyph,
    ink: (top, bottom) => {
      if (commandsBlob) return savedGlyphInk(commandsBlob, glyph, top, bottom)
      return commands ? outlineInk(commands, glyph.x, glyph.y, top, bottom) : null
    }
  }
}

/** Decorations as Figma saves them, over glyphs saved or just shaped. */
function textDecorations(
  node: SceneNode,
  glyphs: readonly PlacedTextGlyph[]
): TextDecorationRecord[] {
  return textDecorationRects(node, glyphs.map(decoratedGlyph)).map(
    ({ firstCharacter, x, y, width, height }) => ({ firstCharacter, x, y, width, height })
  )
}

function needsShaping(graph: SceneGraph): boolean {
  for (const node of graph.nodes.values()) {
    if (node.type === 'TEXT' && node.text && !node.derivedTextGlyphs?.length) return true
  }
  return false
}

/** Run a `.fig` or Figma clipboard write with text shaping. */
export async function withFigExportRuntime<T>(
  graph: SceneGraph,
  ck: CanvasKit | undefined,
  write: (runtime: FigNodeChangeExportRuntime) => Promise<T>
): Promise<T> {
  const named = { textDecorations, fontStyleName: faceStyleName }
  if (!needsShaping(graph)) return write({ ...EMPTY_EXPORT_RUNTIME, ...named })
  return withTextShaper(ck ?? (await getCanvasKit()), (shapeText) => write({ shapeText, ...named }))
}
