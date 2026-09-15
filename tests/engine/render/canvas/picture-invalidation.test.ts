import { expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { EffectRasterCache } from '#core/canvas/renderer/effect-raster-cache'
import { invalidateAllPictures, invalidateNodePicture } from '#core/canvas/renderer/state'
import { TextPreparationCache } from '#core/canvas/text/preparation-cache'

function deletable() {
  return { delete: mock() }
}

test('full picture invalidation resets tiled font-dependent resources', () => {
  const scenePicture = deletable()
  const backingImage = deletable()
  const nodePicture = deletable()
  const subtreePicture = deletable()
  const textPreparationCache = new TextPreparationCache()
  textPreparationCache.clear = mock()
  const renderer = {
    textPreparationCache,
    scenePicture,
    scenePictureVersion: 1,
    scenePictureFontGeneration: 1,
    sceneBacking: { image: backingImage },
    sceneBackingBuild: null,
    nodePictureCache: new Map([['node', nodePicture]]),
    nodePictureCacheGenerations: new Map([['node', 1]]),
    nodePictureCacheDependencies: new Map([['node', []]]),
    effectRasterCache: new EffectRasterCache(),
    subtreePictureCache: new Map([['subtree', { picture: subtreePicture }]]),
    subtreePictureCachePageId: 'page',
    subtreePictureCacheSceneVersion: 1,
    subtreePictureCachePositionPreviewVersion: 1,
    subtreePictureCacheFontGeneration: 1,
    tiledScene: { invalidateStructure: mock() }
  } as SkiaRenderer

  invalidateAllPictures(renderer)

  expect(textPreparationCache.clear).toHaveBeenCalledTimes(1)
  expect(renderer.tiledScene.invalidateStructure).toHaveBeenCalledTimes(1)
  expect(scenePicture.delete).toHaveBeenCalledTimes(1)
  expect(backingImage.delete).toHaveBeenCalledTimes(1)
  expect(nodePicture.delete).toHaveBeenCalledTimes(1)
  expect(subtreePicture.delete).toHaveBeenCalledTimes(1)
})

test('node picture invalidation removes pictures that depend on a changed child', () => {
  const parentPicture = deletable()
  const childPicture = deletable()
  const textPreparationCache = new TextPreparationCache()
  textPreparationCache.deleteNode = mock()
  const renderer = {
    textPreparationCache,
    nodePictureCache: new Map([
      ['parent', parentPicture],
      ['child', childPicture]
    ]),
    nodePictureCacheGenerations: new Map([
      ['parent', 1],
      ['child', 1]
    ]),
    nodePictureCacheDependencies: new Map([
      ['parent', ['child']],
      ['child', []]
    ]),
    effectRasterCache: new EffectRasterCache(),
    subtreePictureCache: new Map()
  } as SkiaRenderer

  invalidateNodePicture(renderer, 'child')

  expect(textPreparationCache.deleteNode).toHaveBeenCalledWith('child')
  expect(parentPicture.delete).toHaveBeenCalledTimes(1)
  expect(childPicture.delete).toHaveBeenCalledTimes(1)
  expect(renderer.nodePictureCache.size).toBe(0)
})
