import { afterEach, expect, test } from 'bun:test'

import {
  checkStockPhotoKey,
  getStockPhotoProvider,
  setPexelsAPIKey,
  setUnsplashAccessKey
} from '#core/tools/stock-photo/providers'

const realFetch = globalThis.fetch
/** Each request the providers sent, and an answer per path. */
let requests: URL[] = []

function answer(byPath: Record<string, unknown>) {
  requests = []
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input)
      requests.push(url)
      const body = byPath[url.pathname]
      return body === undefined ? new Response('missing', { status: 404 }) : Response.json(body)
    },
    { preconnect: realFetch.preconnect }
  )
}

afterEach(() => {
  globalThis.fetch = realFetch
  setPexelsAPIKey(null)
  setUnsplashAccessKey(null)
})

test('Unsplash results credit the photographer with referral links, and a used photo is reported', async () => {
  answer({
    '/search/photos': {
      results: [
        {
          id: 'abc',
          width: 1200,
          height: 800,
          urls: { raw: 'r', full: 'f', regular: 'g', small: 's', thumb: 't' },
          user: { name: 'Ann Lee', links: { html: 'https://unsplash.com/@ann' } },
          links: {
            html: 'https://unsplash.com/photos/abc',
            download_location: 'https://api.unsplash.com/photos/abc/download?ixid=1'
          }
        }
      ]
    },
    '/photos/abc/download': { url: 'f' }
  })
  setUnsplashAccessKey('key')
  const provider = getStockPhotoProvider('unsplash')
  if (!provider) throw new Error('Unsplash was not registered')

  const [photo] = await provider.search('hills', { perPage: 3, page: 2, targetDim: 1080 })
  expect(photo).toEqual({
    url: 'g',
    thumbnailURL: 's',
    width: 1200,
    height: 800,
    photographer: 'Ann Lee',
    photographerURL: 'https://unsplash.com/@ann?utm_source=openpencil&utm_medium=referral',
    pageURL: 'https://unsplash.com/photos/abc?utm_source=openpencil&utm_medium=referral',
    sourceId: 'abc'
  })
  expect(Object.fromEntries(requests[0].searchParams)).toEqual({
    query: 'hills',
    per_page: '3',
    page: '2'
  })

  await provider.reportUse?.(photo)
  expect(requests[1].pathname).toBe('/photos/abc/download')
})

test('a malformed answer fails the search instead of returning half a photo', async () => {
  answer({ '/v1/search': { photos: [{ id: 1, width: 10 }] } })
  setPexelsAPIKey('key')
  const provider = getStockPhotoProvider('pexels')
  if (!provider) throw new Error('Pexels was not registered')
  await expect(provider.search('sea', { perPage: 1, targetDim: 100 })).rejects.toThrow()
})

test('removing a key unregisters its service', () => {
  setPexelsAPIKey('key')
  expect(getStockPhotoProvider('pexels')).not.toBeNull()
  setPexelsAPIKey(null)
  expect(getStockPhotoProvider('pexels')).toBeNull()
})

const UNSPLASH_PHOTO = {
  id: 'abc',
  width: 1200,
  height: 800,
  urls: { raw: 'r', full: 'f', regular: 'g', small: 's', thumb: 't' },
  user: { name: 'Ann Lee', links: { html: 'https://unsplash.com/@ann' } },
  links: {
    html: 'https://unsplash.com/photos/abc',
    download_location: 'https://api.unsplash.com/photos/abc/download'
  }
}

test('before a search, Unsplash lists its editorial feed and Pexels its curated photos', async () => {
  answer({
    '/photos': [UNSPLASH_PHOTO],
    '/v1/curated': {
      photos: [
        {
          id: 7,
          width: 10,
          height: 10,
          url: 'https://www.pexels.com/photo/7',
          photographer: 'Bo',
          photographer_url: 'https://www.pexels.com/@bo',
          src: { original: 'o', large2x: 'l2', large: 'l', medium: 'm', small: 's' }
        }
      ]
    }
  })
  setUnsplashAccessKey('key')
  setPexelsAPIKey('key')
  const unsplash = await getStockPhotoProvider('unsplash')?.browse?.({
    perPage: 24,
    targetDim: 1080
  })
  const pexels = await getStockPhotoProvider('pexels')?.browse?.({ perPage: 24, targetDim: 1080 })
  expect(unsplash?.map((photo) => photo.sourceId)).toEqual(['abc'])
  expect(pexels?.map((photo) => photo.sourceId)).toEqual(['7'])
  expect(requests.map((url) => `${url.pathname}?${url.searchParams}`)).toEqual([
    '/photos?per_page=24&page=1',
    '/v1/curated?per_page=24&page=1'
  ])
})

test('a key check tells a working key from a refused one, a used-up hour, and no answer', async () => {
  const answers: (Response | Error)[] = [
    new Response('[]'),
    new Response('OAuth error: The access token is invalid', { status: 401 }),
    new Response('Rate Limit Exceeded', {
      status: 403,
      headers: { 'X-Ratelimit-Remaining': '0' }
    }),
    new Response('', { status: 429 }),
    new TypeError('Load failed')
  ]
  requests = []
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request) => {
      requests.push(new URL(input instanceof Request ? input.url : input))
      const next = answers.shift()
      if (!next || next instanceof Error) throw next ?? new Error('no answer')
      return next
    },
    { preconnect: realFetch.preconnect }
  )
  expect(await checkStockPhotoKey('unsplash', 'good')).toBe('ok')
  expect(await checkStockPhotoKey('unsplash', 'bad')).toBe('rejected')
  expect(await checkStockPhotoKey('unsplash', 'busy')).toBe('rate-limited')
  expect(await checkStockPhotoKey('pexels', 'busy')).toBe('rate-limited')
  expect(await checkStockPhotoKey('pexels', 'offline')).toBe('network')
  expect(requests.map((url) => url.pathname)).toEqual([
    '/photos',
    '/photos',
    '/photos',
    '/v1/curated',
    '/v1/curated'
  ])
})
