import { describe, expect, test } from 'bun:test'

import { CLOUD_BOOTSTRAP_ID, parseCloudBootstrap } from '@open-pencil/cloud/contract'
import {
  createCloudflareWorker,
  type CloudflareCloudEnvironment
} from '@open-pencil/cloud/runtime/cloudflare'

const environment = {
  HYPERDRIVE: { connectionString: 'postgresql://localhost/test' },
  OPENPENCIL_CLOUD_CONFIG: {
    schema_version: 2,
    deployment: {
      mode: 'self-hosted',
      public_url: 'https://cloud.example.com',
      indexing: 'deny',
      trusted_origins: []
    },
    authentication: { enrollment_mode: 'open' },
    object_storage: {
      endpoint: 'https://objects.example.com',
      region: 'us-east-1',
      bucket: 'openpencil'
    },
    email: { transport: 'none' }
  },
  BETTER_AUTH_SECRET: 'cloudflare-assets-test-secret-at-least-32-characters',
  S3_ENDPOINT: 'https://objects.example.com',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'openpencil',
  S3_ACCESS_KEY_ID: 'access-key',
  S3_SECRET_ACCESS_KEY: 'secret-key',
  ASSETS: {
    async fetch(request: Request) {
      return new Response(
        `<script id="openpencil-cloud-bootstrap" type="application/json"></script>${new URL(request.url).pathname}`,
        { headers: { 'Content-Type': 'text/html' } }
      )
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
      '/auth/sign-in',
      '/auth/sign-up',
      '/auth/verify-email',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/app/account/security',
      '/account/pending',
      '/app',
      '/admin'
    ]) {
      const html = await (
        await worker.fetch(new Request(`https://cloud.example.com${path}`), environment, context)
      ).text()
      expect(html).toContain(path)
      const source = html.match(
        new RegExp(`id="${CLOUD_BOOTSTRAP_ID}" type="application/json">([^<]+)</script>`)
      )?.[1]
      expect(source ? parseCloudBootstrap(source) : null).toMatchObject({
        authentication: { socialProviders: [], enrollmentMode: 'open' }
      })
    }
  })
})
