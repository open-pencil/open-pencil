import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'

type CanvasKitRegistration = Parameters<ReturnType<typeof createEditor>['setCanvasKit']>[0]
type RendererRegistration = Parameters<ReturnType<typeof createEditor>['setCanvasKit']>[1]

const canvasKit = {} as CanvasKitRegistration

function rendererStub(): RendererRegistration {
  return {} as RendererRegistration
}

describe('editor canvas renderers', () => {
  test('keeps the primary renderer when an auxiliary canvas registers', () => {
    const editor = createEditor()
    const scene = rendererStub()
    const overlays = rendererStub()

    editor.setCanvasKit(canvasKit, scene, 'primary')
    editor.setCanvasKit(canvasKit, overlays, 'auxiliary')

    expect(editor.renderer).toBe(scene)
    expect(editor.canvasRenderers).toEqual([scene, overlays])
  })

  test('promotes a replacement primary after the original is removed', () => {
    const editor = createEditor()
    const scene = rendererStub()
    const overlays = rendererStub()
    const replacementScene = rendererStub()

    editor.setCanvasKit(canvasKit, scene, 'primary')
    editor.setCanvasKit(canvasKit, overlays, 'auxiliary')
    editor.removeCanvasRenderer(scene)
    expect(editor.renderer).toBe(overlays)

    editor.setCanvasKit(canvasKit, replacementScene, 'primary')
    expect(editor.renderer).toBe(replacementScene)
  })
})
