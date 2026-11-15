import { expect, test } from 'bun:test'

import {
  getActiveProvider,
  setActiveStockPhotoProvider,
  setPexelsAPIKey,
  setUnsplashAccessKey
} from '#core/tools/stock-photo/providers'

test.each(['pexels', 'unsplash'])('%s resolves credentials only when searching', async (name) => {
  const previous = getActiveProvider()?.name ?? null
  const setCredential = name === 'pexels' ? setPexelsAPIKey : setUnsplashAccessKey
  let reads = 0

  try {
    setCredential(async () => {
      reads++
      return null
    })
    setActiveStockPhotoProvider(name)
    const provider = getActiveProvider()
    if (!provider) throw new Error('Missing registered provider')
    expect(reads).toBe(0)

    await expect(
      provider.search('forest', {
        perPage: 1,
        orientation: 'landscape',
        targetDim: 100
      })
    ).rejects.toThrow('not configured')
    expect(reads).toBe(1)
  } finally {
    setCredential(null)
    setActiveStockPhotoProvider(previous)
  }
})
