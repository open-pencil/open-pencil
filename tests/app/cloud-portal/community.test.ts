import { describe, expect, test } from 'bun:test'

import { openCommunityInBrowser, openCommunityInDesktop } from '@/app/cloud-portal/community'

const DOCUMENT = '0b6f4f9e-3c1a-4d7e-9a52-6f1c2d3e4f50'
const VERSION = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a'

/** A page at the server's address that records where it was sent. */
function page() {
  const visited: string[] = []
  return {
    origin: 'https://cloud.example',
    assign: (url: string) => void visited.push(url),
    visited
  }
}

describe('opening a community document', () => {
  test('in the browser, at the editor’s address, with the version picked', () => {
    const location = page()
    openCommunityInBrowser({ documentId: DOCUMENT, versionId: null }, location)
    openCommunityInBrowser({ documentId: DOCUMENT, versionId: VERSION }, location)
    expect(location.visited).toEqual([
      `https://cloud.example/community/${DOCUMENT}/open`,
      `https://cloud.example/community/${DOCUMENT}/open?version=${VERSION}`
    ])
  })

  test('in the desktop app, through its link to the same address', () => {
    const location = page()
    openCommunityInDesktop({ documentId: DOCUMENT, versionId: VERSION }, location)
    const link = new URL(location.visited[0] ?? '')
    expect(link.protocol).toBe('openpencil:')
    expect(link.searchParams.get('url')).toBe(
      `https://cloud.example/community/${DOCUMENT}/open?version=${VERSION}`
    )
  })
})
