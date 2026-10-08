import { describe, expect, test } from 'bun:test'

import { createIconifyAPIClient } from '#core/icons/api'
import { createIconifyProvider } from '#core/icons/provider'

const SET = {
  prefix: 'test',
  width: 24,
  height: 24,
  icons: {
    square: { body: '<path fill="currentColor" d="M2 2h20v20H2z"/>' },
    wide: { body: '<path fill="currentColor" d="M0 0h32v16H0z"/>', width: 32, height: 16 }
  },
  aliases: { box: { parent: 'square' } }
}

/** A provider over a fake API that serves `SET` and counts its requests. */
function setup() {
  const requests: string[] = []
  const fetcher = async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : input)
    requests.push(url.pathname + url.search)
    return Response.json(SET)
  }
  const provider = createIconifyProvider(createIconifyAPIClient(fetcher as typeof fetch, 'https://icons.test'))
  return { provider, requests }
}

describe('Iconify provider', () => {
  test('previews draw each icon in its own box, with the color left to the page', async () => {
    const { provider } = setup()
    const previews = await provider.previews(['test:square', 'test:wide', 'test:box', 'test:gone'])

    expect([...previews.keys()]).toEqual(['test:square', 'test:wide', 'test:box'])
    expect(previews.get('test:wide')).toContain('viewBox="0 0 32 16"')
    expect(previews.get('test:square')).toContain('fill="currentColor"')
    expect(previews.get('test:box')).toBe(previews.get('test:square'))
  })

  test('previews and placed icons share one request per set', async () => {
    const { provider, requests } = setup()
    await provider.previews(['test:square', 'test:wide'])
    const icons = await provider.icons(['test:square', 'test:wide'], 48)

    expect(requests).toHaveLength(1)
    expect(icons.get('test:wide')).toMatchObject({ name: 'wide', width: 48 })
  })

  test('a name without a set is refused', async () => {
    const { provider } = setup()
    await expect(provider.previews(['square'])).rejects.toThrow('prefix:name')
  })
})
