import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { cloudDesktopLinkURL } from '@open-pencil/cloud/contract'

import { readCloudLink } from '@/app/cloud/links'

const SERVER = 'https://cloud.example.com'

describe('Cloud links', () => {
  test('a web link names its kind, id, and secret, and its own address is the server', () => {
    expect(readCloudLink(new URL(`${SERVER}/invitations/abc#token`))).toEqual({
      kind: 'invitations',
      id: 'abc',
      server: SERVER,
      secret: 'token'
    })
    expect(readCloudLink(new URL(`${SERVER}/share/s%201#secret`))).toEqual({
      kind: 'share',
      id: 's 1',
      server: SERVER,
      secret: 'secret'
    })
  })

  test('other addresses and links missing a part are not Cloud links', () => {
    for (const address of [
      `${SERVER}/`,
      `${SERVER}/documents/abc#secret`,
      `${SERVER}/rooms/abc#secret`,
      `${SERVER}/share/abc/more#secret`,
      `${SERVER}/share/abc`,
      `${SERVER}/share/%E0%A4#secret`
    ]) {
      expect(readCloudLink(new URL(address))).toBeNull()
    }
  })

  test('the desktop form of a web link carries the same link', () => {
    const web = readCloudLink(new URL(`${SERVER}/share/abc#secret`))
    if (!web) throw new Error('Expected a Cloud link')
    const desktop = new URL(cloudDesktopLinkURL(web.kind, web.id, web.server, web.secret))
    expect([desktop.protocol, desktop.host]).toEqual(['openpencil:', 'cloud'])
    expect(desktop.searchParams.get('url')).toBe(`${SERVER}/share/abc`)
    expect(desktop.hash).toBe('#secret')
  })
})
