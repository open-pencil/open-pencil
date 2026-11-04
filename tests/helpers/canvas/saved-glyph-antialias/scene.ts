import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

export const SAVED_GLYPH_SAMPLES = [
  { fontSize: 20, fontWeight: 400, fontStyle: 'Regular' },
  { fontSize: 18, fontWeight: 400, fontStyle: 'Regular' },
  { fontSize: 20, fontWeight: 600, fontStyle: 'SemiBold' }
]
export const SAVED_GLYPH_ROW_TOP = 12
export const SAVED_GLYPH_ROW_PITCH = 40

/** One line of Inter per sample on a white sheet; returns every layer it made. */
export function createSavedGlyphScene(graph: SceneGraph, pageId: string): string[] {
  const paper = graph.createNode('RECTANGLE', pageId, {
    name: 'Paper',
    width: 180,
    height: 140,
    fills: [solid(1, 1, 1)]
  })
  const lines = SAVED_GLYPH_SAMPLES.map((sample, index) =>
    graph.createNode('TEXT', pageId, {
      ...sample,
      name: `Saved ${sample.fontSize}/${sample.fontWeight}`,
      text: `Quick AVW ${sample.fontSize}`,
      x: 12,
      y: SAVED_GLYPH_ROW_TOP + index * SAVED_GLYPH_ROW_PITCH,
      width: 150,
      height: 30,
      fontFamily: 'Inter',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      fills: [solid(0.08, 0.08, 0.08)]
    })
  )
  return [paper.id, ...lines.map((line) => line.id)]
}
