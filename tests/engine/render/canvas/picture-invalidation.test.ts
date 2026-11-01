import { expect, mock, test } from 'bun:test'

import { EffectRasterCache } from '#core/canvas/renderer/effect-raster-cache'
import { invalidateAllPictures, invalidateNodePicture } from '#core/canvas/renderer/state'
import { TextPreparationCache } from '#core/canvas/text/preparation/cache'

import { asRenderer } from './helpers'

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
  const renderer = asRenderer({
    textPreparationCache,
    textReadiness: new Map(),
    scenePicture,
    scenePictureVersion: 1,
    scenePictureFontGeneration: 1,
    sceneBacking: { image: backingImage },
    sceneBackingBuild: null,
    nodePictureCache: new Map([['node', nodePicture]]),
    nodePictureCacheGenerations: new Map([['node', 1]]),
    effectRasterCache: new EffectRasterCache(),
    subtreePictureCache: new Map([['subtree', { picture: subtreePicture }]]),
    subtreePictureCachePageId: 'page',
    subtreePictureCacheSceneVersion: 1,
    subtreePictureCachePositionPreviewVersion: 1,
    subtreePictureCacheFontGeneration: 1,
    tiledScene: { invalidateStructure: mock() }
  })

  invalidateAllPictures(renderer)

  expect(textPreparationCache.clear).toHaveBeenCalledTimes(1)
  expect(renderer.tiledScene.invalidateStructure).toHaveBeenCalledTimes(1)
  expect(scenePicture.delete).toHaveBeenCalledTimes(1)
  expect(backingImage.delete).toHaveBeenCalledTimes(1)
  expect(nodePicture.delete).toHaveBeenCalledTimes(1)
  expect(subtreePicture.delete).toHaveBeenCalledTimes(1)
})

test('node picture invalidation removes the changed node picture and keeps its parent', () => {
  const parentPicture = deletable()
  const childPicture = deletable()
  const textPreparationCache = new TextPreparationCache()
  textPreparationCache.deleteNode = mock()
  const renderer = asRenderer({
    textPreparationCache,
    textReadiness: new Map(),
    nodePictureCache: new Map([
      ['parent', parentPicture],
      ['child', childPicture]
    ]),
    nodePictureCacheGenerations: new Map([
      ['parent', 1],
      ['child', 1]
    ]),
    effectRasterCache: new EffectRasterCache(),
    subtreePictureCache: new Map()
  })

  invalidateNodePicture(renderer, 'child')

  expect(textPreparationCache.deleteNode).toHaveBeenCalledWith('child', {
    keepShaping: false
  })
  expect(parentPicture.delete).not.toHaveBeenCalled()
  expect(childPicture.delete).toHaveBeenCalledTimes(1)
  expect([...renderer.nodePictureCache.keys()]).toEqual(['parent'])

  invalidateNodePicture(renderer, 'child', ['width', 'height', 'x'])
  expect(textPreparationCache.deleteNode).toHaveBeenLastCalledWith('child', {
    keepShaping: true
  })
  invalidateNodePicture(renderer, 'child', ['width', 'text'])
  expect(textPreparationCache.deleteNode).toHaveBeenLastCalledWith('child', {
    keepShaping: false
  })
})
