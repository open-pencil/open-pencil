import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import { readCloudDocumentLink } from '@/app/cloud/documents/link'

const SERVER = 'https://cloud.example.com'
const DOCUMENT = '1413785f-37aa-4935-8bfb-e2cd81a035cf'

describe('Cloud document links', () => {
  test('an address names the document and the version it shows; its own address is the server', () => {
    const base = `${SERVER}/documents/${DOCUMENT}`
    expect(readCloudDocumentLink(new URL(base))).toEqual({
      documentId: DOCUMENT,
      server: SERVER,
      versionId: null
    })
    expect(readCloudDocumentLink(new URL(`${base}?version=v1`))?.versionId).toBe('v1')
  })

  test('another address or a broken escape is no link', () => {
    expect(readCloudDocumentLink(new URL(`${SERVER}/documents/%E0`))).toBeNull()
    expect(readCloudDocumentLink(new URL(`${SERVER}/share/${DOCUMENT}`))).toBeNull()
    expect(readCloudDocumentLink(new URL(`${SERVER}/`))).toBeNull()
  })
})
