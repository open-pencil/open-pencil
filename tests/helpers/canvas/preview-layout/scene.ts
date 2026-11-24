import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { withBehaviour } from '@open-pencil/scene-graph/behaviours'

import { solid } from '../paints'

/** A layer's box as the canvas lays it out, in its parent. */
export interface LayoutBox {
  x: number
  y: number
  width: number
  height: number
}

/** The frame to preview, with its height and its layers' boxes by name. */
export interface PreviewLayoutScene {
  id: string
  height: number
  boxes: Record<string, LayoutBox>
}

/** A button, so the frame that holds an instance of it runs as a preview island. */
function createButton(graph: SceneGraph, pageId: string) {
  const button = graph.createNode('COMPONENT', pageId, { x: 600, y: 120, width: 107, height: 34 })
  const behaviour = { kind: 'button', booleans: {}, texts: {}, numbers: {}, parts: {} } as const
  graph.updateNode(button.id, { pluginData: withBehaviour(button, behaviour) })
  return button
}

function laidOut(graph: SceneGraph, pageId: string, frame: SceneNode): PreviewLayoutScene {
  computeAllLayouts(graph, pageId)
  const boxes = graph
    .getChildren(frame.id)
    .map(({ name, x, y, width, height }) => [name, { x, y, width, height }])
  return {
    id: frame.id,
    height: graph.getNode(frame.id)?.height ?? 0,
    boxes: Object.fromEntries(boxes)
  }
}

/** A space-between row 12 px too narrow for its label and control. */
export function createOverfullRow(graph: SceneGraph, pageId: string): PreviewLayoutScene {
  const button = createButton(graph, pageId)
  const row = graph.createNode('FRAME', pageId, {
    x: 120,
    y: 120,
    width: 312,
    height: 60,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'FIXED',
    primaryAxisAlign: 'SPACE_BETWEEN',
    counterAxisAlign: 'CENTER',
    itemSpacing: 16
  })
  graph.createNode('RECTANGLE', row.id, { name: 'Label', width: 217, height: 34 })
  graph.createInstance(button.id, row.id, { name: 'Control' })
  return laidOut(graph, pageId, row)
}

/** A card whose stroke is left out of layout, holding a layer that fills it and two lines of text. */
export function createStrokedCard(graph: SceneGraph, pageId: string): PreviewLayoutScene {
  const button = createButton(graph, pageId)
  const card = graph.createNode('FRAME', pageId, {
    x: 120,
    y: 120,
    width: 360,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
    strokes: [{ ...solid(0, 0, 0), weight: 1, align: 'INSIDE' }]
  })
  graph.createNode('RECTANGLE', card.id, { name: 'Fill', height: 20, layoutAlignSelf: 'STRETCH' })
  graph.createNode('TEXT', card.id, {
    name: 'Lines',
    text: 'One\nTwo',
    fontFamily: 'Inter',
    fontSize: 15,
    textAutoResize: 'WIDTH_AND_HEIGHT'
  })
  graph.createInstance(button.id, card.id, { name: 'Control' })
  return laidOut(graph, pageId, card)
}
