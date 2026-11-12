import { describe, expect, test } from 'bun:test'

import { FigmaAPI, type FigmaViewportHost } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

function tool(name: string) {
  const def = ALL_TOOLS.find((candidate) => candidate.name === name)
  if (!def) throw new Error(`${name} tool missing`)
  return def
}

const zoomToFit = tool('zoom_to_fit')
const setViewport = tool('set_viewport')

function setup(viewport?: FigmaViewportHost) {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph, { viewport })
  const pageId = graph.getPages()[0].id
  const frame = (width: number, height: number) =>
    graph.createNode('FRAME', pageId, { x: 100, y: 50, width, height }).id
  return { figma, pageId, frame }
}

/** A host view that records what it was asked to do and settles where it was told. */
function recordingHost() {
  const calls: { fit: { pageId: string; bounds: Rect }[]; set: { pageId: string }[] } = {
    fit: [],
    set: []
  }
  let view: { center: Vector; zoom: number } = { center: { x: 0, y: 0 }, zoom: 1 }
  const host: FigmaViewportHost = {
    get: () => view,
    set: (pageId, center, zoom) => {
      calls.set.push({ pageId })
      view = { center, zoom }
    },
    fit: (pageId, bounds) => {
      calls.fit.push({ pageId, bounds })
      view = {
        center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        zoom: 2
      }
    }
  }
  return { host, calls }
}

// #1390: the tool centred the layers but always set 100%.
describe('zoom_to_fit without a host view', () => {
  test('zooms out until a layer larger than the window fits', async () => {
    const { figma, frame } = setup()
    const id = frame(4000, 2400)

    await zoomToFit.execute(figma, { ids: [id] })

    const { zoom, center } = figma.viewport
    expect(4000 * zoom).toBeLessThanOrEqual(1280)
    expect(2400 * zoom).toBeLessThanOrEqual(720)
    expect(center).toEqual({ x: 2100, y: 1250 })
  })

  test('zooms in on a layer smaller than the window', async () => {
    const { figma, frame } = setup()

    await zoomToFit.execute(figma, { ids: [frame(200, 120)] })

    expect(figma.viewport.zoom).toBeGreaterThan(1)
  })
})

describe('the view of a host that shows the document', () => {
  test('zoom_to_fit fits the layers in it and answers with the view it settled on', async () => {
    const { host, calls } = recordingHost()
    const { figma, pageId, frame } = setup(host)
    const id = frame(400, 300)

    const result = await zoomToFit.execute(figma, { ids: [id] })

    expect(calls.fit).toEqual([{ pageId, bounds: { x: 100, y: 50, width: 400, height: 300 } }])
    expect(result).toMatchObject({ center: { x: 300, y: 200 }, zoom: 2 })
  })

  test('set_viewport moves it', async () => {
    const { host, calls } = recordingHost()
    const { figma, pageId } = setup(host)

    const result = await setViewport.execute(figma, { x: 10, y: 20, zoom: 0.5 })

    expect(calls.set).toEqual([{ pageId }])
    expect(result).toEqual({ x: 10, y: 20, zoom: 0.5 })
    expect(figma.viewport.center).toEqual({ x: 10, y: 20 })
  })
})
