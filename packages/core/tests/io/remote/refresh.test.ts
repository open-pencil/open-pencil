import { describe, expect, test } from 'bun:test'

import { immediateRefresh } from '#core/io/remote/refresh'

const BASE = 'https://pages.example.test/'
const page = (content: string) =>
  `<!doctype html><html><head><meta http-equiv="Refresh" content="${content}"></head><body></body></html>`

describe('immediateRefresh', () => {
  test('reads where a page sends a browser at once, however the URL is written', () => {
    expect(immediateRefresh(page('0; url=https://docs.example.test/pages'), BASE)?.href).toBe(
      'https://docs.example.test/pages'
    )
    expect(immediateRefresh(page("0;URL='/moved'"), BASE)?.href).toBe(
      'https://pages.example.test/moved'
    )
    expect(immediateRefresh(page('0, next.html'), BASE)?.href).toBe(
      'https://pages.example.test/next.html'
    )
  })

  test('leaves a page that refreshes later, reloads itself, or has no refresh', () => {
    expect(immediateRefresh(page('5; url=/later'), BASE)).toBeNull()
    expect(immediateRefresh(page('0'), BASE)).toBeNull()
    expect(immediateRefresh('<p>Plain page</p>', BASE)).toBeNull()
  })
})
