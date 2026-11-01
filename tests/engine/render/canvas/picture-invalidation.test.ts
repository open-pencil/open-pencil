import { expect, mock, test } from 'bun:test'

import { invalidateAllPictures, invalidateNodePicture } from '#core/canvas/renderer/state'
import { TextPreparationCache } from '#core/canvas/text/preparation/cache'

import { asRenderer } from './helpers'

function deletable() {
  return { delete: mock() }
}

test('full picture invalidation resets tiled font-dependent resources', () => {
  const scenePicture = deletable()
  const nodePicture = deletable()
  const textPreparationCache = new TextPreparationCache()
  textPreparationCache.clear = mock()
  const renderer = asRenderer({
    textPreparationCache,
    textFonts: { readiness: new Map() },
    wholeScene: { picture: scenePicture, version: 1, fontGeneration: 1 },
    nodePictures: new Map([['node', { picture: nodePicture, fontGeneration: 1 }]]),
    tiledScene: { invalidateStructure: mock() }
  })

  invalidateAllPictures(renderer)

  expect(textPreparationCache.clear).toHaveBeenCalledTimes(1)
  expect(renderer.tiledScene.invalidateStructure).toHaveBeenCalledTimes(1)
  expect(scenePicture.delete).toHaveBeenCalledTimes(1)
  expect(nodePicture.delete).toHaveBeenCalledTimes(1)
})

test('node picture invalidation removes the changed node picture and keeps its parent', () => {
  const parentPicture = deletable()
  const childPicture = deletable()
  const textPreparationCache = new TextPreparationCache()
  textPreparationCache.deleteNode = mock()
  const renderer = asRenderer({
    textPreparationCache,
    textFonts: { readiness: new Map() },
    nodePictures: new Map([
      ['parent', { picture: parentPicture, fontGeneration: 1 }],
      ['child', { picture: childPicture, fontGeneration: 1 }]
    ])
  })

  invalidateNodePicture(renderer, 'child')

  expect(textPreparationCache.deleteNode).toHaveBeenCalledWith('child', {
    keepShaping: false
  })
  expect(parentPicture.delete).not.toHaveBeenCalled()
  expect(childPicture.delete).toHaveBeenCalledTimes(1)
  expect([...renderer.nodePictures.keys()]).toEqual(['parent'])

  invalidateNodePicture(renderer, 'child', ['width', 'height', 'x'])
  expect(textPreparationCache.deleteNode).toHaveBeenLastCalledWith('child', {
    keepShaping: true
  })
  invalidateNodePicture(renderer, 'child', ['width', 'text'])
  expect(textPreparationCache.deleteNode).toHaveBeenLastCalledWith('child', {
    keepShaping: false
  })
})
