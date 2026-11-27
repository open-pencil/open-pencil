import type { SceneGraph } from '@open-pencil/scene-graph'

import { solid } from '../paints'

/**
 * "Hello world" at 18 on the open page, beside a colour variable "Accent" and a text style
 * "Heading" at 28 to apply to some of its characters; returns the text's ID.
 */
export function createSelectionStyleScene(graph: SceneGraph, pageId: string): string {
  const collection = graph.createCollection('Brand')
  graph.createVariable('Accent', 'COLOR', collection.id, { r: 0.9, g: 0.1, b: 0.2, a: 1 })
  const style = graph.createNode('TEXT', pageId, {
    name: 'Heading',
    sharedStyleType: 'TEXT',
    internalOnly: true,
    fontFamily: 'Inter',
    fontSize: 28
  })
  style.source.id = 'style:heading'
  return graph.createNode('TEXT', pageId, {
    name: 'Greeting',
    x: 200,
    y: 200,
    width: 240,
    height: 40,
    text: 'Hello world',
    fontSize: 18,
    fills: [solid(0, 0, 0)]
  }).id
}
