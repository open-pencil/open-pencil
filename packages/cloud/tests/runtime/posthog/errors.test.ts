import { describe, expect, spyOn, test } from 'bun:test'
import { gunzipSync } from 'node:zlib'

import { createPostHogErrorReporter } from '#cloud/runtime/posthog/errors'
import { parseCloudServerConfig } from '#cloud/server'
import * as v from 'valibot'

type ErrorTracking = { provider: 'posthog'; host: string; projectAPIKey: string }

function config(errorTracking?: ErrorTracking) {
  return parseCloudServerConfig({
    deployment: 'self-hosted',
    publicURL: 'https://cloud.example.com',
    databaseURL: 'postgresql://user:password@database/openpencil',
    authSecret: 'auth-secret-at-least-32-characters-long',
    s3Endpoint: 'https://objects.example.com',
    s3Region: 'us-east-1',
    s3Bucket: 'openpencil',
    s3AccessKeyId: 'access-key',
    s3SecretAccessKey: 'secret-key',
    errorTracking
  })
}

/** The batch PostHog was sent, which the SDK compresses. */
function sentJSON(body: unknown): unknown {
  if (!(body instanceof Uint8Array)) throw new Error('Expected a compressed body')
  const text = new TextDecoder().decode(gunzipSync(body))
  return v.parse(v.pipe(v.string(), v.parseJson(), v.unknown()), text)
}

describe('PostHog error reporter', () => {
  test('is not created without error tracking', () => {
    expect(createPostHogErrorReporter(config(), 'node')).toBeUndefined()
  })

  test('sends an anonymous exception to the configured host as it is caught', async () => {
    const sent: { url: string; body: unknown }[] = []
    const report = createPostHogErrorReporter(
      config({ provider: 'posthog', host: 'https://eu.i.posthog.com', projectAPIKey: 'phc_test' }),
      'cloudflare',
      {
        fetch: async (url, options) => {
          sent.push({ url, body: options.body })
          return { status: 200, text: async () => '{}', json: async () => ({}) }
        }
      }
    )
    await report?.(new TypeError('row missing'), {
      source: 'request',
      method: 'POST',
      route: '/api/documents/:id'
    })

    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('https://eu.i.posthog.com/batch/')
    expect(sentJSON(sent[0]?.body)).toMatchObject({
      api_key: 'phc_test',
      batch: [
        {
          event: '$exception',
          properties: {
            $process_person_profile: false,
            $geoip_disable: true,
            $exception_list: [{ type: 'TypeError', value: 'row missing' }],
            cloud_runtime: 'cloudflare',
            cloud_deployment: 'self-hosted',
            cloud_host: 'cloud.example.com',
            cloud_source: 'request',
            http_method: 'POST',
            http_route: '/api/documents/:id'
          }
        }
      ]
    })
  })

  test('logs a report PostHog refuses', async () => {
    const logged = spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const report = createPostHogErrorReporter(
        config({ provider: 'posthog', host: 'https://eu.i.posthog.com', projectAPIKey: 'phc_x' }),
        'node',
        {
          fetch: async () => ({ status: 401, text: async () => '{}', json: async () => ({}) })
        }
      )
      await report?.(new Error('broken'), { source: 'cleanup' })
      const refusal = logged.mock.calls.find(
        ([message]) => message === '[Cloud] PostHog refused an error report:'
      )
      expect(refusal?.[1]).toBeInstanceOf(Error)
    } finally {
      logged.mockRestore()
    }
  })
})
