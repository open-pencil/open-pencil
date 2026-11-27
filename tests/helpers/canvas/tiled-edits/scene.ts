import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/**
 * A frame filling the view with a few layers, fewer than a frame needs to be split into chunks
 * of its own, so the whole frame is one chunk. Tiles are 512 px: the text sits just above the
 * first row's lower edge, so a second line crosses it, and the square sits in the first tile.
 */
export function createSmallFrameScene(graph: SceneGraph, pageId: string) {
  const frame = graph.createNode('FRAME', pageId, {
    name: 'Card',
    x: 0,
    y: 0,
    width: 1200,
    height: 760,
    fills: [solid(1, 1, 1)]
  })
  const text = graph.createNode('TEXT', frame.id, {
    name: 'Heading',
    text: 'Edit me',
    x: 40,
    y: 460,
    width: 400,
    height: 40,
    fontSize: 32,
    fills: [solid(0.1, 0.1, 0.12)],
    textAutoResize: 'HEIGHT'
  })
  const square = graph.createNode('RECTANGLE', frame.id, {
    name: 'Square',
    x: 100,
    y: 120,
    width: 120,
    height: 120,
    fills: [solid(0.2, 0.4, 0.8)]
  })
  graph.createNode('TEXT', frame.id, {
    name: 'Caption',
    text: 'A caption that stays put',
    x: 700,
    y: 680,
    width: 400,
    height: 30,
    fontSize: 20,
    fills: [solid(0.45, 0.45, 0.5)]
  })
  return { text: text.id, square: square.id }
}
