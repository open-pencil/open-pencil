import { describe, expect, mock, test } from 'bun:test'

import type { Surface } from 'canvaskit-wasm'

import { SkiaRenderer } from '#core/canvas/renderer'

import { asDouble, asRenderer } from './helpers'

function surface() {
  return { delete: mock() } as Surface & { delete: ReturnType<typeof mock> }
}

describe('renderer surface replacement', () => {
  test('clears context-owned tiled resources before replacing the main surface', () => {
    const previous = surface()
    const next = surface()
    const renderer: Pick<
      SkiaRenderer,
      | 'surface'
      | 'tiledScene'
      | 'sceneBackingAllocationFailed'
      | 'invalidateScenePicture'
      | 'replaceSurface'
    > = {
      surface: previous,
      tiledScene: asDouble<SkiaRenderer['tiledScene']>({ destroy: mock() }),
      sceneBackingAllocationFailed: true,
      invalidateScenePicture: mock(),
      replaceSurface: SkiaRenderer.prototype.replaceSurface
    }

    renderer.replaceSurface.call(asRenderer(renderer), next)

    expect(renderer.tiledScene.destroy).toHaveBeenCalledTimes(1)
    expect(previous.delete).toHaveBeenCalledTimes(1)
    expect(renderer.surface).toBe(next)
    expect(renderer.sceneBackingAllocationFailed).toBe(false)
    expect(renderer.invalidateScenePicture).toHaveBeenCalledTimes(1)
  })
})
