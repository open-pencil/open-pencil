import { describe, expect, test } from 'bun:test'

import { createPresentationReporter } from '#vue/canvas/surface/presented'

function createEditor() {
  const events: string[] = []
  const editor = {
    state: { renderVersion: 1, sceneVersion: 1 },
    reportPresented: () => events.push('presented'),
    reportProgress: () => events.push('progressed')
  }
  return { editor, events }
}

function createRenderer() {
  return { tiledSceneCovered: false, tiledScene: { visibleTileProgress: 0 } }
}

describe('canvas presentation reports', () => {
  test('reports progress on a scene frame that only recorded pictures', () => {
    const { editor, events } = createEditor()
    const renderer = createRenderer()
    const reportPresented = createPresentationReporter(editor, { layer: 'scene' })

    reportPresented(renderer)
    renderer.tiledScene.visibleTileProgress = 1
    reportPresented(renderer)
    reportPresented(renderer)
    renderer.tiledSceneCovered = true
    reportPresented(renderer)

    expect(events).toEqual(['progressed', 'presented'])
  })
})
