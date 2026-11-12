import { compact } from 'es-toolkit'
import * as v from 'valibot'

import { computeBounds } from '@open-pencil/scene-graph/geometry'

import { toolNumber, defineTool } from '#core/tools/schema'

export const viewportGet = defineTool({
  name: 'get_viewport',
  description: 'Get current viewport position and zoom level.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.strictObject({}),
  execute: (figma) => {
    return figma.viewport
  }
})

export const viewportSet = defineTool({
  name: 'set_viewport',

  description: 'Set viewport position and zoom.',
  execution: { kind: 'sync', mutation: 'view' },
  input: v.strictObject({
    x: toolNumber(v.pipe(v.number(), v.description('Center X'))),
    y: toolNumber(v.pipe(v.number(), v.description('Center Y'))),
    zoom: toolNumber(v.pipe(v.number(), v.minValue(0.01), v.description('Zoom level')))
  }),
  execute: (figma, { x, y, zoom }) => {
    figma.viewport = { center: { x, y }, zoom }
    // The view the host settled on, whose zoom it may have clamped.
    const { center, zoom: applied } = figma.viewport
    return { x: center.x, y: center.y, zoom: applied }
  }
})

export const viewportZoomToFit = defineTool({
  name: 'zoom_to_fit',

  description:
    'Scroll and zoom the view so the given layers fill it, zooming in or out, as Zoom to selection does.',
  execution: { kind: 'sync', mutation: 'view' },
  input: v.strictObject({
    ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Node IDs to fit in view'))
  }),
  execute: (figma, { ids }) => {
    const nodes = compact(ids.map((id) => figma.getNodeById(id)))
    if (nodes.length === 0) return { error: 'No valid nodes found' }
    figma.viewport.scrollAndZoomIntoView(nodes)
    const { center, zoom } = figma.viewport
    return { center, zoom, bounds: computeBounds(nodes.map((node) => node.absoluteBoundingBox)) }
  }
})
