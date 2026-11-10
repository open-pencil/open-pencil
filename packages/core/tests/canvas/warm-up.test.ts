import { afterAll, describe, expect, test } from 'bun:test'

import type { Surface } from '@open-pencil/canvaskit'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'
import { SceneGraph, type Effect } from '@open-pencil/scene-graph'
import { expectDefined } from '@open-pencil/test-support/assert'

import { warmUpEffectPrograms } from '#core/canvas/warm-up'

const ck = await getCanvasKit()
const renderers: SkiaRenderer[] = []
afterAll(() => {
  for (const renderer of renderers) renderer.destroy()
})

/** A renderer at rest on `pageId`, counting the offscreen surfaces it makes. */
function settledRenderer(pageId: string, makesSurfaces = true) {
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(64, 64), 'surface'))
  renderers.push(renderer)
  renderer.pageId = pageId
  renderer.navigationPhase = 'idle'
  renderer.tiledSceneBackgroundPending = false
  const made = { count: 0 }
  const make = renderer.surface.makeSurface.bind(renderer.surface)
  renderer.surface.makeSurface = (info) => {
    made.count++
    // Typed as always made; a canvas that cannot allocate one makes none.
    return (makesSurfaces ? make(info) : null) as Surface
  }
  return { renderer, made }
}

const progressive: Effect = {
  type: 'BACKGROUND_BLUR',
  color: { r: 0, g: 0, b: 0, a: 0 },
  offset: { x: 0, y: 0 },
  radius: 20,
  spread: 0,
  visible: true,
  progressive: { startRadius: 0, startOffset: { x: 0.5, y: 0 }, endOffset: { x: 0.5, y: 1 } }
}
const glass: Effect = {
  ...progressive,
  type: 'GLASS',
  progressive: undefined,
  glass: { refraction: 0.5, depth: 10, lightAngle: -45, lightIntensity: 0.5, dispersion: 0 }
}

function pageWith(effects: Effect[]) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, { width: 200, height: 200 })
  graph.createNode('RECTANGLE', frame.id, { width: 100, height: 100, effects })
  return { graph, pageId: page.id }
}

describe('effect program warm-up', () => {
  test('draws once a page with a progressive blur settles on a scene canvas', () => {
    const { graph, pageId } = pageWith([progressive])
    const { renderer, made } = settledRenderer(pageId)
    renderer.navigationPhase = 'zoom'
    warmUpEffectPrograms(renderer, graph, 'scene', 0)
    renderer.navigationPhase = 'idle'
    warmUpEffectPrograms(renderer, graph, 'overlays', 0)
    expect(made.count).toBe(0)
    warmUpEffectPrograms(renderer, graph, 'scene', 0)
    expect(renderer.effectProgramsWarm).toBe(true)
    expect(made.count).toBe(1)
    // Warm, it never draws again, on this page or another.
    warmUpEffectPrograms(renderer, graph, 'scene', 0)
    const other = pageWith([glass])
    renderer.pageId = other.pageId
    warmUpEffectPrograms(renderer, other.graph, 'full', 0)
    expect(made.count).toBe(1)
  })

  test('skips pages without such effects or with them hidden, then warms on one with glass', () => {
    const plain = pageWith([{ ...progressive, progressive: undefined }])
    const hidden = pageWith([{ ...glass, visible: false }])
    const { renderer, made } = settledRenderer(plain.pageId)
    warmUpEffectPrograms(renderer, plain.graph, 'full', 0)
    renderer.pageId = hidden.pageId
    warmUpEffectPrograms(renderer, hidden.graph, 'full', 0)
    expect(made.count).toBe(0)
    expect(renderer.effectProgramsWarm).toBe(false)
    const shiny = pageWith([glass])
    renderer.pageId = shiny.pageId
    warmUpEffectPrograms(renderer, shiny.graph, 'full', 0)
    expect(made.count).toBe(1)
    expect(renderer.effectProgramsWarm).toBe(true)
  })

  test('scans a page found without such effects again once the document changes', () => {
    const { graph, pageId } = pageWith([])
    const { renderer, made } = settledRenderer(pageId)
    warmUpEffectPrograms(renderer, graph, 'scene', 1)
    const layer = expectDefined(graph.getChildren(graph.getChildren(pageId)[0].id)[0], 'layer')
    graph.updateNode(layer.id, { effects: [glass] })
    // Until the document's version moves on, the page counts as scanned.
    warmUpEffectPrograms(renderer, graph, 'scene', 1)
    expect(made.count).toBe(0)
    warmUpEffectPrograms(renderer, graph, 'scene', 2)
    expect(made.count).toBe(1)
    expect(renderer.effectProgramsWarm).toBe(true)
  })

  test('stays cold when no surface can be made, and tries again on the next page', () => {
    const first = pageWith([progressive])
    const { renderer, made } = settledRenderer(first.pageId, false)
    warmUpEffectPrograms(renderer, first.graph, 'scene', 0)
    warmUpEffectPrograms(renderer, first.graph, 'scene', 0)
    expect(made.count).toBe(1)
    expect(renderer.effectProgramsWarm).toBe(false)
    const second = pageWith([glass])
    renderer.pageId = second.pageId
    warmUpEffectPrograms(renderer, second.graph, 'scene', 0)
    expect(made.count).toBe(2)
  })
})
