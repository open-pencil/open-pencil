import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { fetchStub } from '@open-pencil/test-support/fetch'
import { FIXTURES } from '@open-pencil/test-support/paths'

import { BUILTIN_IO_FORMATS, IORegistry } from '#core/io'
import { fetchRemoteFile, remoteFileKind, remoteFileTitle } from '#core/io/remote'

const io = new IORegistry(BUILTIN_IO_FORMATS)
const text = (value: string) => new TextEncoder().encode(value)

function kindOf(name: string, bytes: Uint8Array, contentType?: string) {
  return remoteFileKind({ name, bytes, contentType }, io)
}

describe('remoteFileKind', () => {
  test('reads PDF and image bytes whatever the server calls them', async () => {
    const png = await Bun.file(join(FIXTURES, 'absolute-constraint-figma.png')).bytes()
    const pdf = text('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')
    expect(await kindOf('download', pdf, 'application/octet-stream')).toBe('pdf')
    expect(await kindOf('photo', png, 'text/plain')).toBe('image')
  })

  test('opens a design document by its name', async () => {
    expect(await kindOf('board.fig', text('fig-kiwi'), 'application/octet-stream')).toBe('document')
    expect(await kindOf('flow.mmd', text('flowchart TD\n  A --> B'), 'text/plain')).toBe('document')
  })

  test('takes a page or an SVG by its media type', async () => {
    expect(await kindOf('', text('<p>Hi</p>'), 'text/html')).toBe('html')
    expect(await kindOf('page', text('<p>Hi</p>'), 'application/xhtml+xml')).toBe('html')
    expect(await kindOf('logo', text('<svg/>'), 'image/svg+xml')).toBe('svg')
  })

  test('takes one served with a generic type, or none, by its extension', async () => {
    expect(await kindOf('index.html', text('<p>Hi</p>'), 'text/plain')).toBe('html')
    expect(await kindOf('logo.SVG', text('<svg/>'), 'application/octet-stream')).toBe('svg')
    expect(await kindOf('logo.svg', text('<svg/>'))).toBe('svg')
  })

  test('leaves anything else unsupported', async () => {
    expect(await kindOf('notes.txt', text('hello'), 'text/plain')).toBe('unsupported')
    expect(await kindOf('', text('<p>Hi</p>'), 'text/plain')).toBe('unsupported')
  })
})

describe('remoteFileTitle', () => {
  test('calls a document by its file name without the extension, and a page without one by its host', () => {
    expect(remoteFileTitle(new URL('https://cdn.example.com/a/my%20design.fig'))).toBe('my design')
    expect(remoteFileTitle(new URL('https://example.com/docs/index.html'))).toBe('index')
    expect(remoteFileTitle(new URL('https://example.com/'))).toBe('example.com')
  })
})

describe('fetchRemoteFile', () => {
  test('resolves against the address a redirect ends at', async () => {
    const fetch = fetchStub(async () => {
      const response = new Response('<!doctype html><p>Hi</p>', {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
      Object.defineProperty(response, 'url', { value: 'https://www.example.com/docs/' })
      return response
    })

    const file = await fetchRemoteFile(new URL('https://example.com/docs'), { fetch, io })

    expect(file).toMatchObject({
      url: 'https://www.example.com/docs/',
      name: 'docs',
      title: 'docs',
      contentType: 'text/html',
      kind: 'html'
    })
  })

  test('follows a page that sends a browser elsewhere at once, as a browser does', async () => {
    const pages: Record<string, string> = {
      'https://pages.example.test/':
        '<meta http-equiv="refresh" content="0; url=https://docs.example.test/pages">',
      'https://docs.example.test/pages': '<!doctype html><p>Docs</p>',
      'https://loop.example.test/':
        '<meta http-equiv="refresh" content="0; url=https://loop.example.test/">'
    }
    const fetch = fetchStub(async (input) => {
      const url = input instanceof Request ? input.url : input.toString()
      const response = new Response(pages[url] ?? '', { headers: { 'content-type': 'text/html' } })
      Object.defineProperty(response, 'url', { value: url })
      return response
    })

    const followed = await fetchRemoteFile(new URL('https://pages.example.test/'), { fetch, io })
    const looping = await fetchRemoteFile(new URL('https://loop.example.test/'), { fetch, io })

    expect(followed).toMatchObject({ url: 'https://docs.example.test/pages', kind: 'html' })
    expect(looping.url).toBe('https://loop.example.test/')
  })

  test('says why a response cannot be imported', async () => {
    const missing = fetchStub(
      async () => new Response('gone', { status: 404, statusText: 'Not Found' })
    )
    const empty = fetchStub(async () => new Response(null))
    const url = new URL('https://example.com/page')

    await expect(fetchRemoteFile(url, { fetch: missing, io })).rejects.toThrow('404 Not Found')
    await expect(fetchRemoteFile(url, { fetch: empty, io })).rejects.toThrow('carried no body')
  })
})
