import type { SceneGraph, TextDecoration } from '@open-pencil/scene-graph'

import { solid } from '../paints'

const RED = solid(0.9, 0.2, 0.15)
const GREEN = solid(0.25, 0.6, 0.2)
const BLUE = solid(0.1, 0.2, 0.95)
const ORANGE = solid(0.95, 0.55, 0.2)

/** "Hey yo" rows whose style runs change fill under one underline or strikethrough. */
const ROWS: { y: number; decoration: TextDecoration; runs: [number, number, typeof RED][] }[] = [
  {
    y: 60,
    decoration: 'UNDERLINE',
    runs: [
      [0, 1, BLUE],
      [1, 5, RED]
    ]
  },
  {
    y: 150,
    decoration: 'UNDERLINE',
    runs: [
      [0, 1, RED],
      [1, 1, GREEN],
      [2, 3, BLUE],
      [5, 1, ORANGE]
    ]
  },
  {
    y: 240,
    decoration: 'STRIKETHROUGH',
    runs: [
      [0, 1, RED],
      [1, 5, BLUE]
    ]
  }
]

/** Three decorated texts, each with several fills along its decoration; returns their IDs. */
export function createDecorationColourScene(graph: SceneGraph, pageId: string): string[] {
  return ROWS.map(
    ({ y, decoration, runs }) =>
      graph.createNode('TEXT', pageId, {
        name: `Hey yo ${decoration} ${y}`,
        x: 80,
        y,
        width: 320,
        height: 72,
        text: 'Hey yo',
        fontSize: 56,
        textAutoResize: 'HEIGHT',
        textDecoration: decoration,
        fills: [solid(0.08, 0.1, 0.18)],
        styleRuns: runs.map(([start, length, fill]) => ({
          start,
          length,
          style: { fills: [fill] }
        }))
      }).id
  )
}
