import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createNodeAdminAssetHandler } from '@open-pencil/cloud/runtime/node'

describe('Node admin assets', () => {
  test('serves the SPA for public, account, product, admin, and asset paths', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'openpencil-cloud-admin-'))
    try {
      await writeFile(join(directory, 'index.html'), '<div>admin</div>')
      const handler = createNodeAdminAssetHandler(directory)
      expect(await handler(new Request('https://cloud.example.com/api/health'))).toBeNull()
      for (const path of [
        '/',
        '/join',
        '/sign-in',
        '/sign-up',
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
