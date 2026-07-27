import { describe, expect, spyOn, test } from 'bun:test'

import {
  extractVectorizedSVGURL,
  getVectorizeProvider,
  validateVectorizedAssetURL
} from '@/app/editor/vectorize/providers'
import { appCredentialRefs } from '@/app/settings/credentials/persistence'
import { credentialKey } from '@/app/settings/credentials/reference'

describe('vectorization providers', () => {
  test('extracts supported nested SVG response URLs', () => {
    expect(extractVectorizedSVGURL({ image: { url: 'https://cdn.recraft.ai/a.svg' } })).toBe(
      'https://cdn.recraft.ai/a.svg'
    )
    expect(extractVectorizedSVGURL({ data: [{ url: 'https://v3.fal.media/a.svg' }] })).toBe(
      'https://v3.fal.media/a.svg'
    )
    expect(extractVectorizedSVGURL({ data: { image: { url: 'https://fal.media/a.svg' } } })).toBe(
      'https://fal.media/a.svg'
    )
  })

  test('allows only provider-owned HTTPS asset hosts', () => {
    expect(validateVectorizedAssetURL('recraft', 'https://cdn.recraft.ai/a.svg').hostname).toBe(
      'cdn.recraft.ai'
    )
    expect(validateVectorizedAssetURL('fal', 'https://v3.fal.media/a.svg').hostname).toBe(
      'v3.fal.media'
    )
    expect(() => validateVectorizedAssetURL('recraft', 'https://example.com/a.svg')).toThrow(
      'untrusted'
    )
    expect(() => validateVectorizedAssetURL('fal', 'http://fal.media/a.svg')).toThrow('untrusted')
  })

  test('rejects redirects from trusted asset hosts to untrusted hosts', async () => {
    let requestCount = 0
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => {
      requestCount += 1
      if (requestCount === 1) {
        return Response.json({ image: { url: 'https://cdn.recraft.ai/result.svg' } })
      }
      const response = new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        headers: { 'content-type': 'image/svg+xml' }
      })
      Object.defineProperty(response, 'url', { value: 'https://example.com/result.svg' })
      return response
    })

    try {
      await expect(
        getVectorizeProvider('recraft').vectorize(new Uint8Array([1, 2, 3]), 'secret')
      ).rejects.toThrow('untrusted')
      expect(requestCount).toBe(2)
    } finally {
      fetchSpy.mockRestore()
    }
  })

  test('includes vectorization keys in browser persistence changes', () => {
    const keys = appCredentialRefs().map(credentialKey)
    expect(keys).toContain('v1:vectorize-recraft:default:api-key')
    expect(keys).toContain('v1:vectorize-fal:default:api-key')
  })
})
