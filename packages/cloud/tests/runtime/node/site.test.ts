import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { developmentSiteFiles, nodeSiteFiles } from '#cloud/runtime/node/site'

let directory = ''

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'openpencil-site-'))
  await mkdir(join(directory, 'assets'))
  await writeFile(join(directory, 'assets', 'cloud-abc.js'), 'export {}')
  await writeFile(join(directory, 'demo.fig'), 'fig-kiwi')
  await writeFile(join(tmpdir(), 'openpencil-site-outside.txt'), 'secret')
})

afterAll(async () => {
  await rm(directory, { recursive: true, force: true })
  await rm(join(tmpdir(), 'openpencil-site-outside.txt'), { force: true })
})

const request = new Request('https://cloud.example/')

describe('Node site files', () => {
  test('reads a file with its media type', async () => {
    const file = await nodeSiteFiles(directory)('/assets/cloud-abc.js', request)
    expect(file?.type).toContain('javascript')
    expect(new TextDecoder().decode(file?.body instanceof Uint8Array ? file.body : undefined)).toBe(
      'export {}'
    )
  })

  test('never reads outside its directory or answers missing files', async () => {
    const files = nodeSiteFiles(directory)
    expect(await files('/..%2Fopenpencil-site-outside.txt', request)).toBeNull()
    expect(await files('/assets/missing.js', request)).toBeNull()
  })

  test('reads files without a registered media type as bytes', async () => {
    const file = await nodeSiteFiles(directory)('/demo.fig', request)
    expect(file?.type).toBe('application/octet-stream')
  })
})

describe('development site files', () => {
  const asked: { url: string; headers: Headers }[] = []
  const development = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      asked.push({
        url: url.pathname + url.search,
        headers: request.headers
      })
      if (url.pathname === '/missing.js') return new Response('', { status: 404 })
      return new Response('export {}', { headers: { 'Content-Type': 'text/javascript' } })
    }
  })
  afterAll(() => development.stop(true))
  const files = developmentSiteFiles(development.url.origin)

  test('asks the development server for the requested file, query and all, never cached', async () => {
    asked.length = 0
    const module = new Request('https://cloud.example/src/main.ts?t=1', {
      headers: {
        Accept: '*/*',
        'Sec-Fetch-Dest': 'script',
        Cookie: 'session=secret',
        Authorization: 'Bearer secret',
        Range: 'bytes=0-9',
        'If-None-Match': 'W/"stale"'
      }
    })
    const file = await files('/src/main.ts', module)
    expect(file?.type).toBe('text/javascript')
    expect(file?.cacheControl).toBe('no-cache')
    expect(asked.map(({ url }) => url)).toEqual(['/src/main.ts?t=1'])
    const forwarded = asked[0]?.headers
    expect(forwarded?.get('Accept')).toBe('*/*')
    expect(forwarded?.get('Sec-Fetch-Dest')).toBe('script')
    for (const name of ['Cookie', 'Authorization', 'Range', 'If-None-Match']) {
      expect(forwarded?.has(name)).toBe(false)
    }
  })

  test('asks for a page the server routes there without the address query', async () => {
    asked.length = 0
    await files('/cloud.html', new Request('https://cloud.example/account?tab=security'))
    expect(asked.map(({ url }) => url)).toEqual(['/cloud.html'])
  })

  test('answers nothing for a missing file or an unreachable server', async () => {
    expect(await files('/missing.js', request)).toBeNull()
    expect(await developmentSiteFiles('http://127.0.0.1:9')('/src/main.ts', request)).toBeNull()
  })
})
