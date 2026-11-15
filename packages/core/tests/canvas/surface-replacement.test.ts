import { describe, expect, mock, test } from 'bun:test'

import type { Image, Surface } from '@open-pencil/canvaskit'

import { SkiaRenderer } from '#core/canvas/renderer'

import { asDouble, asRenderer } from './helpers'

function surface() {
  return { delete: mock() } as Surface & { delete: ReturnType<typeof mock> }
}

function liveImage() {
  return asDouble<Image & { delete: ReturnType<typeof mock> }>({ delete: mock() })
}

function rendererOn(previous: Surface, image: Image) {
  const renderer: Pick<
    SkiaRenderer,
    | 'surface'
    | 'images'
    | 'tiledScene'
    | 'glassMaps'
    | 'invalidateScenePicture'
    | 'invalidateAllPictures'
    | 'replaceSurface'
  > = {
    surface: previous,
    images: asDouble<SkiaRenderer['images']>({
      live: new Map([['shader', { image, surface: previous }]])
    }),
    tiledScene: asDouble<SkiaRenderer['tiledScene']>({ destroy: mock() }),
    glassMaps: asDouble<SkiaRenderer['glassMaps']>({ clear: mock() }),
    invalidateScenePicture: mock(),
    invalidateAllPictures: mock(),
    replaceSurface: SkiaRenderer.prototype.replaceSurface
  }
  return renderer
}

describe('renderer surface replacement', () => {
  test('clears context-owned resources when the surface comes from a new context', () => {
    const previous = surface()
    const next = surface()
    const image = liveImage()
    const renderer = rendererOn(previous, image)

    renderer.replaceSurface.call(asRenderer(renderer), next)

    expect(renderer.tiledScene.destroy).toHaveBeenCalledTimes(1)
    expect(image.delete).toHaveBeenCalledTimes(1)
    // Glass maps and the node pictures that recorded them belong to the old context too.
    expect(renderer.glassMaps.clear).toHaveBeenCalledTimes(1)
    expect(renderer.invalidateAllPictures).toHaveBeenCalledTimes(1)
    expect(renderer.images.live.size).toBe(0)
    expect(previous.delete).toHaveBeenCalledTimes(1)
    expect(renderer.surface).toBe(next)
    expect(renderer.invalidateScenePicture).toHaveBeenCalledTimes(1)
  })

  test('keeps tiles and live textures when the surface shares the context, as on resize', () => {
    const previous = surface()
    const next = surface()
    const image = liveImage()
    const renderer = rendererOn(previous, image)

    renderer.replaceSurface.call(asRenderer(renderer), next, { sameContext: true })

    expect(renderer.tiledScene.destroy).not.toHaveBeenCalled()
    expect(image.delete).not.toHaveBeenCalled()
    expect(renderer.glassMaps.clear).not.toHaveBeenCalled()
    expect(renderer.invalidateAllPictures).not.toHaveBeenCalled()
    expect(renderer.images.live.get('shader')).toEqual({ image, surface: next })
    expect(previous.delete).toHaveBeenCalledTimes(1)
    expect(renderer.surface).toBe(next)
    expect(renderer.invalidateScenePicture).toHaveBeenCalledTimes(1)
  })
})
