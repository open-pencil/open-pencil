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
    expect(kindOf('download', text('%PDF-1.7\n'), 'application/octet-stream')).toBe('pdf')
    expect(kindOf('photo', png, 'text/plain')).toBe('image')
  })

  test('opens a design document by its name', () => {
    expect(kindOf('board.fig', text('fig-kiwi'), 'application/octet-stream')).toBe('document')
    expect(kindOf('flow.mmd', text('flowchart TD\n  A --> B'), 'text/plain')).toBe('document')
  })

  test('tells pages from SVG by media type, then by the markup they start with', () => {
    expect(kindOf('example.com', text('<p>Hi</p>'), 'text/html')).toBe('html')
    expect(kindOf('logo', text('<svg/>'), 'image/svg+xml')).toBe('svg')
    expect(kindOf('index', text('\uFEFF <!-- built --> <!DOCTYPE html><html>'))).toBe('html')
    expect(kindOf('logo', text('<?xml version="1.0"?>\n<svg viewBox="0 0 1 1">'))).toBe('svg')
    expect(
      kindOf('logo', text('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "svg11.dtd">\n<svg>'))
    ).toBe('svg')
    expect(kindOf('logo', text(`<!-- ${'licence '.repeat(200)} -->\n<svg>`), 'text/plain')).toBe(
      'svg'
    )
  })

  test('leaves anything else unsupported', () => {
    expect(kindOf('notes.txt', text('hello'), 'text/plain')).toBe('unsupported')
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
