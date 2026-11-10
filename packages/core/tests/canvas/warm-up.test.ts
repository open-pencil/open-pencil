import { afterAll, describe, expect, test } from 'bun:test'

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

function settledRenderer(pageId: string): SkiaRenderer {
  const renderer = new SkiaRenderer(ck, expectDefined(ck.MakeSurface(64, 64), 'surface'))
  renderers.push(renderer)
  renderer.pageId = pageId
  renderer.navigationPhase = 'idle'
  renderer.tiledSceneBackgroundPending = false
  return renderer
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

function pageWith(effects: Effect[]) {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const frame = graph.createNode('FRAME', page.id, { width: 200, height: 200 })
  graph.createNode('RECTANGLE', frame.id, { width: 100, height: 100, effects })
  return { graph, pageId: page.id }
}

describe('effect program warm-up', () => {
  test('runs once a page with a progressive blur settles, and only once', () => {
    const { graph, pageId } = pageWith([progressive])
    const renderer = settledRenderer(pageId)
    renderer.navigationPhase = 'zoom'
    warmUpEffectPrograms(renderer, graph, 'scene')
    expect(renderer.effectProgramsWarm).toBe(false)
    renderer.navigationPhase = 'idle'
    warmUpEffectPrograms(renderer, graph, 'overlays')
    expect(renderer.effectProgramsWarm).toBe(false)
    warmUpEffectPrograms(renderer, graph, 'scene')
    expect(renderer.effectProgramsWarm).toBe(true)
  })

  test('leaves a page without such effects alone, checking it once', () => {
    const { graph, pageId } = pageWith([{ ...progressive, progressive: undefined }])
    const renderer = settledRenderer(pageId)
    warmUpEffectPrograms(renderer, graph, 'full')
    expect(renderer.effectProgramsWarm).toBe(false)
    expect(renderer.effectWarmUpCheckedPage).toBe(pageId)
  })
})
