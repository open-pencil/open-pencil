import { convertFills, convertStrokes } from '@open-pencil/fig/node-change'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

const SHADER = {
  type: 'CUSTOM' as const,
  opacity: 0.5,
  customEffectId: { assetRef: { key: 'abc', version: 'v1' } },
  componentPropAssignments: [
    { defID: { sessionID: 1, localID: 2 }, varValue: { value: { floatValue: 0.3 } } }
  ]
}
const GREEN = solid(0.2, 0.6, 0.4)

const TILE = { x: 40, y: 40, size: 120, step: 140 }
const STROKE_BAND_INSET = 6

function pointInStrokeBand(index: number) {
  return { x: TILE.x + STROKE_BAND_INSET + index * TILE.step, y: TILE.y + STROKE_BAND_INSET }
}

export function createFigmaShaderTilesScene(graph: SceneGraph, pageId: string) {
  const shaderFills = convertFills([SHADER])
  const tiles = [
    { name: 'Solid', fills: [GREEN], strokes: [] },
    { name: 'Solid under shader', fills: [GREEN, ...shaderFills], strokes: [] },
    { name: 'Shader only', fills: shaderFills, strokes: [] },
    {
      name: 'Shader stroke',
      fills: [GREEN],
      strokes: convertStrokes([{ ...SHADER, opacity: 1 }], 12, 'INSIDE')
    }
  ]
  for (const [index, tile] of tiles.entries()) {
    graph.createNode('RECTANGLE', pageId, {
      ...tile,
      x: TILE.x + index * TILE.step,
      y: TILE.y,
      width: TILE.size,
      height: TILE.size
    })
  }
  return {
    tileProbes: tiles.map((_, index) => pointInStrokeBand(index)),
    backgroundProbe: pointInStrokeBand(tiles.length)
  }
}
