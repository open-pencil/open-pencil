import { describe, expect, mock, spyOn, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'

import { createPostHogErrorReporter } from '#cloud/errors'
import * as v from 'valibot'

/** A PostHog that accepts every batch, recording what it was sent. */
function fakePostHog() {
  const sent: unknown[] = []
  const fetch = async (_url: string, options: { body?: unknown }) => {
    sent.push(options.body)
    return { status: 200, text: async () => '{}', json: async () => ({}) }
  }
  return { sent, fetch }
}

/** The batch PostHog was sent, which the SDK compresses. */
function sentJSON(body: unknown): unknown {
  if (!(body instanceof Uint8Array)) throw new Error('Expected a compressed body')
  const text = new TextDecoder().decode(gunzipSync(body))
  return v.parse(v.pipe(v.string(), v.parseJson(), v.unknown()), text)
}

describe('createPostHogErrorReporter', () => {
  test("sends the caller's properties and names the source as the caller asks", async () => {
    const posthog = fakePostHog()
    const report = createPostHogErrorReporter<'search'>({
      key: 'phc_test',
      host: 'https://eu.i.posthog.com',
      properties: { service: 'openpencil-services', service_deployment: 'staging' },
      sourceProperty: 'service_source',
      logName: 'Services',
      fetch: posthog.fetch
    })
    await report(new Error('provider down'), {
      source: 'search',
      method: 'POST',
      route: '/v1/search'
    })

    expect(sentJSON(posthog.sent[0])).toMatchObject({
      batch: [
        {
          event: '$exception',
          properties: {
            $process_person_profile: false,
            service: 'openpencil-services',
            service_deployment: 'staging',
            service_source: 'search',
            http_method: 'POST',
            http_route: '/v1/search'
          }
        }
      ]
    })
  })

  test('reads a key it could not read again with the next error, and never rejects', async () => {
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const posthog = fakePostHog()
      let reads = 0
      const key = mock(async () => {
        reads += 1
        if (reads === 1) throw new Error('No such secret')
        return 'phc_test'
      })
      const report = createPostHogErrorReporter({
        key,
        host: 'https://eu.i.posthog.com',
        properties: {},
        sourceProperty: 'service_source',
        logName: 'Services',
        fetch: posthog.fetch
      })

      expect(await report(new Error('first'), { source: 'settlement' })).toBeUndefined()
      expect(posthog.sent).toEqual([])
      expect(logged).toHaveBeenCalledWith(
        '[Services] Reporting an error failed:',
        expect.any(Error)
      )

      await report(new Error('second'), { source: 'settlement' })
      await report(new Error('third'), { source: 'settlement' })
      expect(key).toHaveBeenCalledTimes(2)
      expect(posthog.sent).toHaveLength(2)
    } finally {
      logged.mockRestore()
    }
  })
})
