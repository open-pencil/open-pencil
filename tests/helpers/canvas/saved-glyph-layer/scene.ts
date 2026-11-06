import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

const MOVE_TO = 1
const LINE_TO = 2
const CLOSE = 0
const GLYPH_BOTTOM_EMS = -0.25
const GLYPH_TOP_EMS = 1.25

export const SAVED_GLYPH_LAYER_BOX = { y: 60, width: 40, height: 20 }
export const SAVED_GLYPH_LAYER_FONT_SIZE = 20
export const SAVED_GLYPH_LAYER_COPIES = [
  { x: 40, opacity: 1 },
  { x: 140, opacity: 0.5 }
]
export const SAVED_GLYPH_LAYER_SHEET = { width: 240, height: 140 }

/** A saved outline standing a quarter em below its baseline and a quarter em above an em. */
function tallGlyphCommands(): Uint8Array {
  const corners = [
    [0, GLYPH_BOTTOM_EMS],
    [1, GLYPH_BOTTOM_EMS],
    [1, GLYPH_TOP_EMS],
    [0, GLYPH_TOP_EMS]
  ]
  const commands = new Uint8Array(corners.length * 9 + 1)
  const view = new DataView(commands.buffer)
  for (const [index, [x, y]] of corners.entries()) {
    commands[index * 9] = index === 0 ? MOVE_TO : LINE_TO
    view.setFloat32(index * 9 + 1, x, true)
    view.setFloat32(index * 9 + 5, y, true)
  }
  commands[corners.length * 9] = CLOSE
  return commands
}

/**
 * A cap-height trimmed letter drawn from its saved outline, as a font that is not installed
 * leaves it, opaque and at half opacity on a white sheet; returns the texts it made.
 */
export function createSavedGlyphLayerScene(graph: SceneGraph, pageId: string): string[] {
  graph.createNode('RECTANGLE', pageId, {
    name: 'Sheet',
    ...SAVED_GLYPH_LAYER_SHEET,
    fills: [solid(1, 1, 1)]
  })
  return SAVED_GLYPH_LAYER_COPIES.map(
    (copy) =>
      graph.createNode('TEXT', pageId, {
        name: `Saved ${copy.opacity}`,
        text: 'A',
        x: copy.x,
        ...SAVED_GLYPH_LAYER_BOX,
        fontSize: SAVED_GLYPH_LAYER_FONT_SIZE,
        fontFamily: 'Saved Glyphs Only',
        leadingTrim: 'CAP_HEIGHT',
        textAutoResize: 'WIDTH_AND_HEIGHT',
        derivedTextHeight: null,
        opacity: copy.opacity,
        fills: [solid(0, 0, 0)],
        derivedTextGlyphs: [
          {
            commandsBlob: tallGlyphCommands(),
            x: 0,
            y: SAVED_GLYPH_LAYER_BOX.height,
            fontSize: SAVED_GLYPH_LAYER_FONT_SIZE,
            firstCharacter: 0
          }
        ]
      }).id
  )
}
