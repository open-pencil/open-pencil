import { describe, expect, test } from 'bun:test'

import {
  createCloudflareWorker,
  type CloudflareCloudEnvironment
} from '@open-pencil/cloud/runtime/cloudflare'

const environment = {
  HYPERDRIVE: { connectionString: 'postgresql://localhost/test' },
  OPENPENCIL_CLOUD_DEPLOYMENT: 'self-hosted',
  OPENPENCIL_CLOUD_URL: 'https://cloud.example.com',
  BETTER_AUTH_SECRET: 'cloudflare-assets-test-secret-at-least-32-characters',
  S3_ENDPOINT: 'https://objects.example.com',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'openpencil',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  ASSETS: {
    async fetch(request: Request) {
      return new Response(new URL(request.url).pathname)
    }
  }
} as CloudflareCloudEnvironment

const context = { waitUntil: () => undefined }

describe('Cloudflare admin assets', () => {
  test('preserves SPA routes for the Assets binding fallback', async () => {
    const worker = createCloudflareWorker()
    for (const path of [
      '/',
      '/join',
      '/sign-in',
      '/sign-up',
      '/account/pending',
      '/app',
      '/admin'
    ]) {
      expect(
        await (
          await worker.fetch(new Request(`https://cloud.example.com${path}`), environment, context)
        ).text()
      ).toBe(path)
    }
  })
})
