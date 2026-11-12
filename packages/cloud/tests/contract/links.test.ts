import { expect, test } from 'bun:test'

import {
  cloudDesktopLinkURL,
  cloudDocumentURL,
  cloudInvitationURL,
  cloudShareURL,
  parseCloudLinkPath
} from '#cloud/contract'

const server = 'https://company.example'

test('a shared link is on the server itself and carries its secret in the fragment', () => {
  const url = new URL(cloudShareURL(server, 'share-id', 'secret'))
  expect(url.origin).toBe('https://company.example')
  expect(url.pathname).toBe('/share/share-id')
  expect(url.search).toBe('')
  expect(url.hash).toBe('#secret')
})

test('links refuse a server address that is not on the web', () => {
  expect(() => cloudShareURL('tauri://localhost', 'id', 'secret')).toThrow()
})

test('a document or version address carries no secret', () => {
  const document = new URL(cloudDocumentURL(server, 'doc-id'))
  expect(document.origin).toBe('https://company.example')
  expect(document.pathname).toBe('/documents/doc-id')
  expect(document.search).toBe('')
  expect(document.hash).toBe('')

  const version = new URL(cloudDocumentURL(server, 'doc-id', 'version-id'))
  expect(version.searchParams.get('version')).toBe('version-id')

  expect(new URL(cloudDocumentURL('https://company.example/#welcome', 'doc-id')).hash).toBe('')
})

test('an invitation carries its token in the fragment', () => {
  const url = new URL(cloudInvitationURL(server, 'invitation/id', 'token'))
  expect(url.origin).toBe('https://company.example')
  expect(url.pathname).toBe('/invitations/invitation%2Fid')
  expect(url.search).toBe('')
  expect(url.hash).toBe('#token')
})

test('link paths name their kind and decoded ID', () => {
  expect(parseCloudLinkPath('/share/s%201')).toEqual({ kind: 'share', id: 's 1' })
  expect(parseCloudLinkPath('/invitations/abc')).toEqual({ kind: 'invitations', id: 'abc' })
  expect(parseCloudLinkPath('/documents/abc')).toEqual({ kind: 'documents', id: 'abc' })
  for (const path of ['/rooms/abc', '/share/abc/more', '/share/', '/share/%E0%A4', '/']) {
    expect(parseCloudLinkPath(path)).toBeNull()
  }
})

test('desktop links carry the web link under the app scheme, with the secret in the fragment', () => {
  const url = new URL(cloudDesktopLinkURL('invitations', 'invitation-id', server, 'secret'))
  expect(url.protocol).toBe('openpencil:')
  expect(url.host).toBe('cloud')
  expect(url.searchParams.get('url')).toBe('https://company.example/invitations/invitation-id')
  expect(url.hash).toBe('#secret')
})
