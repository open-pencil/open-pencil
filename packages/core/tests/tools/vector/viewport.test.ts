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
const getViewport = tool('get_viewport')

function setup(viewport?: FigmaViewportHost) {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph, { viewport })
  const pageId = graph.getPages()[0].id
  const frame = (width: number, height: number) =>
    graph.createNode('FRAME', pageId, { x: 100, y: 50, width, height }).id
  const elsewhere = () => graph.createNode('FRAME', graph.addPage('Other').id, {}).id
  return { figma, pageId, frame, elsewhere }
}

/** A host view that records what it was asked to do and settles where it was told. */
function recordingHost() {
  const calls: { fit: { pageId: string; bounds: Rect }[]; set: { pageId: string }[] } = {
    fit: [],
    set: []
  }
  let view: { center: Vector; zoom: number } = { center: { x: 0, y: 0 }, zoom: 1 }
  const host: FigmaViewportHost = {
    get: () => ({ ...view, bounds: { ...view.center, width: 100, height: 50 } }),
    set: (pageId, center, zoom) => {
      calls.set.push({ pageId })
      view = { center, zoom }
    },
    fit: (pageId, bounds) => {
      calls.fit.push({ pageId, bounds })
      view = {
        center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        zoom: 0.25
      }
    }
  }
  return { host, calls }
}

// Figma's `figma.viewport` is one object whose `center` and `zoom` move the view when set.
describe('figma.viewport', () => {
  test('setting center and zoom moves the host view', () => {
    const { host, calls } = recordingHost()
    const { figma, pageId } = setup(host)

    figma.viewport.zoom = 0.5
    figma.viewport.center = { x: 10, y: 20 }

    expect(calls.set).toEqual([{ pageId }, { pageId }])
    expect(figma.viewport.center).toEqual({ x: 10, y: 20 })
    expect(figma.viewport.zoom).toBe(0.5)
    expect(figma.viewport.bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 })
    expect(figma.viewport).toBe(figma.viewport)
  })

  test('refuses a negative zoom or a center that is not a number, as Figma does', () => {
    const { figma } = setup()

    expect(() => {
      figma.viewport.zoom = -1
    }).toThrow(
      'in set_zoom: Property "viewport.zoom" failed validation: Too small: expected number to be >=0'
    )
    expect(() => {
      figma.viewport.center = { x: Number.NaN, y: 0 }
    }).toThrow('in set_center: Property "viewport.center" failed validation')
    expect(figma.viewport.zoom).toBe(1)
  })

  test('scrollAndZoomIntoView fits layers from another page by their coordinates, as Figma does', () => {
    const { host, calls } = recordingHost()
    const { figma, pageId, elsewhere } = setup(host)
    const node = figma.getNodeById(elsewhere())
    if (!node) throw new Error('node missing')

    figma.viewport.scrollAndZoomIntoView([node])

    expect(calls.fit.map((call) => call.pageId)).toEqual([pageId])
  })

  test('without a host it keeps a view with no screen, which fitting only centres', () => {
    const { figma, frame } = setup()
    figma.viewport.zoom = 0.5
    const node = figma.getNodeById(frame(4000, 2400))
    if (!node) throw new Error('node missing')

    figma.viewport.scrollAndZoomIntoView([node])

    expect(figma.viewport.center).toEqual({ x: 2100, y: 1250 })
    expect(figma.viewport.zoom).toBe(0.5)
    expect(figma.viewport.bounds).toEqual({ x: 2100, y: 1250, width: 0, height: 0 })
  })
})

// #1390: the tool centred the layers but always set 100%, and never moved the view.
describe('viewport tools', () => {
  test('zoom_to_fit fits the layers and answers with the view the host settled on', async () => {
    const { host, calls } = recordingHost()
    const { figma, pageId, frame } = setup(host)

    const result = await zoomToFit.execute(figma, { ids: [frame(400, 300)] })

    expect(calls.fit).toEqual([{ pageId, bounds: { x: 100, y: 50, width: 400, height: 300 } }])
    expect(result).toMatchObject({ center: { x: 300, y: 200 }, zoom: 0.25 })
  })

  test('zoom_to_fit refuses a layer on another page and leaves the view alone', async () => {
    const { host, calls } = recordingHost()
    const { figma, frame, elsewhere } = setup(host)
    const away = elsewhere()

    const result = await zoomToFit.execute(figma, { ids: [frame(400, 300), away] })

    expect(result).toEqual({
      error: `Layers not on page "Page 1": ${away}. Show their page with activate_document (page_id) first.`
    })
    expect(calls.fit).toEqual([])
  })

  test('get_viewport answers with the view as JSON', async () => {
    const { host } = recordingHost()
    const { figma } = setup(host)
    figma.viewport.zoom = 0.5

    const result: unknown = await getViewport.execute(figma, {})

    expect(JSON.parse(JSON.stringify(result))).toEqual({
      center: { x: 0, y: 0 },
      zoom: 0.5,
      bounds: { x: 0, y: 0, width: 100, height: 50 }
    })
  })

  test('set_viewport moves the view and answers with where it settled', async () => {
    const { host } = recordingHost()
    const { figma } = setup(host)

    const result = await setViewport.execute(figma, { x: 10, y: 20, zoom: 0.5 })

    expect(result).toEqual({ x: 10, y: 20, zoom: 0.5 })
    expect(figma.viewport.center).toEqual({ x: 10, y: 20 })
  })
})
