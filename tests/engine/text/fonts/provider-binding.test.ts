import { describe, expect, test } from 'bun:test'

import type { CanvasKit, TypefaceFontProvider } from 'canvaskit-wasm'

import { FontManager } from '@open-pencil/core'

function createRecordingProvider() {
  const registrations: Array<{ family: string; byteLength: number }> = []
  const provider = {
    registerFont(data: ArrayBuffer, family: string) {
      registrations.push({ family, byteLength: data.byteLength })
    }
  } as TypefaceFontProvider
  return { provider, registrations }
}

describe('FontManager.bindProvider', () => {
  test('bindProvider re-registers cached faces onto a newly bound provider', () => {
    const manager = new FontManager()
    const canvasKit = {} as CanvasKit
    const first = createRecordingProvider()
    const second = createRecordingProvider()

    manager.attachProvider(canvasKit, first.provider)
    manager.markLoaded('Galada', 'Regular', new ArrayBuffer(12))
    expect(first.registrations).toEqual([{ family: 'Galada', byteLength: 12 }])

    // Text edit can swap the renderer's provider out from under us; rebinding must
    // carry every cached face over or live paint drops the glyphs.
    manager.bindProvider(canvasKit, second.provider)
    expect(second.registrations).toEqual([{ family: 'Galada', byteLength: 12 }])
    expect(manager.provider()).toBe(second.provider)
  })

  test('bindProvider is a no-op when the provider is unchanged or missing', () => {
    const manager = new FontManager()
    const canvasKit = {} as CanvasKit
    const recording = createRecordingProvider()

    manager.attachProvider(canvasKit, recording.provider)
    manager.markLoaded('Galada', 'Regular', new ArrayBuffer(12))
    const generation = manager.generation()

    manager.bindProvider(canvasKit, recording.provider)
    manager.bindProvider(canvasKit, null)
    expect(manager.generation()).toBe(generation)
    expect(recording.registrations).toEqual([{ family: 'Galada', byteLength: 12 }])
  })
})
