import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createNodeCloudPortal } from '#cloud/runtime/node/portal'

let directory = ''

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'openpencil-portal-'))
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'cloud.html'), '<!doctype html><title>Portal</title>')
  await writeFile(join(directory, 'assets', 'cloud-abc.js'), 'export {}')
  await writeFile(join(directory, 'favicon.svg'), '<svg/>')
  await writeFile(join(tmpdir(), 'openpencil-portal-outside.txt'), 'secret')
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
  await rm(join(tmpdir(), 'openpencil-portal-outside.txt'), { force: true })
})

const request = (path: string, method = 'GET') =>
  new Request(`https://cloud.example${path}`, { method })

describe('Node Cloud portal', () => {
  test('serves the page for portal paths, never framed and never cached', async () => {
    const page = await createNodeCloudPortal(directory).page(
      request('/cloud/device?user_code=ABCD')
    )
    expect(await page?.text()).toContain('Portal')
    expect(page?.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'")
    expect(page?.headers.get('Cache-Control')).toBe('no-cache')
  })

  test('leaves other paths and methods to the API', async () => {
    const portal = createNodeCloudPortal(directory)
    expect(await portal.page(request('/api/session'))).toBeNull()
    expect(await portal.page(request('/account', 'POST'))).toBeNull()
  })

  test('serves hashed assets as immutable and icons briefly cached', async () => {
    const portal = createNodeCloudPortal(directory)
    const asset = await portal.file(request('/assets/cloud-abc.js'))
    expect(asset?.headers.get('Content-Type')).toContain('javascript')
    expect(asset?.headers.get('Cache-Control')).toContain('immutable')
    const icon = await portal.file(request('/favicon.svg'))
    expect(icon?.headers.get('Content-Type')).toContain('image/svg+xml')
    expect(icon?.headers.get('Cache-Control')).not.toContain('immutable')
  })

  test('never reads outside its directory or answers missing files', async () => {
    const portal = createNodeCloudPortal(directory)
    expect(await portal.file(request('/..%2Fopenpencil-portal-outside.txt'))).toBeNull()
    expect(await portal.file(request('/assets/missing.js'))).toBeNull()
    expect(await portal.file(request('/cloud.html'))).toBeNull()
  })
})
