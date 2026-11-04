import { describe, expect, test } from 'bun:test'

import { tabAddressFor } from '@/app/tabs/address'

const roomId = 'abcdefghijklmnopqrstuvwxyz012345'
const cloudRoomId = 'cloud:1413785f-37aa-4935-8bfb-e2cd81a035cf:0'
const home = { path: '/', query: {} }
const document = { path: '/documents/1413785f-37aa-4935-8bfb-e2cd81a035cf', query: {} }

describe('tab address', () => {
  test('shows a room as its link', () => {
    expect(tabAddressFor(roomId, null, home).path).toBe(`/rooms/${roomId}`)
  })

  test('takes a document’s version off when a room’s tab comes up', () => {
    const shown = {
      path: document.path,
      query: { ...document.query, version: 'v1', cloud: 'preview' }
    }
    expect(tabAddressFor(roomId, null, shown)).toEqual({
      path: `/rooms/${roomId}`,
      query: { cloud: 'preview' }
    })
  })

  test('shows a Cloud document at its address, not its room', () => {
    expect(tabAddressFor(cloudRoomId, document, home)).toEqual(document)
    expect(tabAddressFor(cloudRoomId, null, { path: `/rooms/${roomId}`, query: {} }).path).toBe('/')
  })

  test('names the version shown, keeping the rest of the query', () => {
    const version = { ...document, query: { ...document.query, version: 'v1' } }
    expect(tabAddressFor(cloudRoomId, version, { path: '/', query: { cloud: 'preview' } })).toEqual(
      { path: version.path, query: { cloud: 'preview', ...version.query } }
    )
    expect(
      tabAddressFor(cloudRoomId, document, { path: version.path, query: version.query })
    ).toEqual(document)
  })

  test('leaves a room or a document for the home address when the tab has neither', () => {
    expect(tabAddressFor(null, null, { path: `/rooms/${roomId}`, query: {} }).path).toBe('/')
    expect(tabAddressFor(null, null, { path: document.path, query: document.query })).toEqual(home)
    expect(tabAddressFor(null, null, { path: '/demo', query: {} }).path).toBe('/demo')
  })

  test('keeps the document address the app opened with, for startup to open', () => {
    const opened = { path: document.path, query: document.query }
    expect(tabAddressFor(null, null, opened, true)).toEqual(opened)
  })
})
