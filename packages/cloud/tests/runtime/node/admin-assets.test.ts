import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  CLOUD_BOOTSTRAP_ID,
  parseCloudBootstrap,
  type CloudDiscovery
} from '@open-pencil/cloud/contract'
import { createNodeAdminAssetHandler } from '@open-pencil/cloud/runtime/node'

describe('Node admin assets', () => {
  test('serves the SPA for public, account, product, admin, and asset paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'openpencil-cloud-admin-'))
    try {
      await writeFile(
        join(directory, 'index.html'),
        `<script id="${CLOUD_BOOTSTRAP_ID}" type="application/json"></script><div>admin</div>`
      )
      const handler = createNodeAdminAssetHandler(directory, {
        protocolVersion: '1',
        deployment: 'self-hosted',
        apiURL: 'https://cloud.example.com/api',
        authURL: 'https://cloud.example.com/api/auth',
        appURL: 'https://app.example.com',
        authentication: {
          socialProviders: ['google'],
          enterpriseSSO: false,
          enrollmentMode: 'approval'
        },
        capabilities: { documents: true, workspaces: true, collaboration: true }
      } satisfies CloudDiscovery)
      expect(await handler(new Request('https://cloud.example.com/api/health'))).toBeNull()
      const home = await handler(new Request('https://cloud.example.com/'))
      const html = await home?.text()
      expect(html).toContain('admin')
      const source = html?.match(/type="application\/json">([^<]+)<\/script>/)?.[1]
      expect(source ? parseCloudBootstrap(source) : null).toMatchObject({
        authentication: { socialProviders: ['google'], enrollmentMode: 'approval' }
      })
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
        '/account/pending',
        '/app',
        '/admin/users'
      ]) {
        expect(
          await (await handler(new Request(`https://cloud.example.com${path}`)))?.text()
        ).toContain('admin')
      }
    } finally {
      await rm(directory, { recursive: true })
    }
  })
})
