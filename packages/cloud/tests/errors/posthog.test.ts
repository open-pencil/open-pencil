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

  test('names the user and records only when asked to', async () => {
    const context = {
      source: 'request',
      userId: 'user-1',
      resources: { documentId: 'document-1', workspaceId: 'workspace-1' }
    } as const
    const reporter = (includeIds: boolean) => {
      const posthog = fakePostHog()
      const report = createPostHogErrorReporter<'request'>({
        key: 'phc_test',
        host: 'https://eu.i.posthog.com',
        properties: {},
        sourceProperty: 'cloud_source',
        logName: 'Cloud',
        includeIds,
        fetch: posthog.fetch
      })
      return { report, posthog }
    }

    const anonymous = reporter(false)
    await anonymous.report(new Error('failed'), context)
    const [withoutIds] = v.parse(
      v.object({
        batch: v.array(
          v.object({ distinct_id: v.string(), properties: v.record(v.string(), v.unknown()) })
        )
      }),
      sentJSON(anonymous.posthog.sent[0])
    ).batch
    expect(withoutIds?.distinct_id).not.toBe('user-1')
    expect(withoutIds?.properties).not.toHaveProperty('document_id')
    expect(withoutIds?.properties).not.toHaveProperty('workspace_id')

    const identified = reporter(true)
    await identified.report(new Error('failed'), context)
    expect(sentJSON(identified.posthog.sent[0])).toMatchObject({
      batch: [
        {
          distinct_id: 'user-1',
          properties: {
            $process_person_profile: false,
            document_id: 'document-1',
            workspace_id: 'workspace-1'
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
