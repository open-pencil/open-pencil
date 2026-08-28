import { describe, expect, test } from 'bun:test'

import { isDesignClipboardHTML } from '@/app/editor/clipboard/html'

describe('design clipboard HTML recognition', () => {
  test('accepts complete OpenPencil and Figma clipboard comments', () => {
    expect(isDesignClipboardHTML('<!--(openpencil)payload(/openpencil)-->')).toBe(true)
    expect(isDesignClipboardHTML('<span data-buffer="<!--(figma)payload(/figma)-->"></span>')).toBe(
      true
    )
    expect(
      isDesignClipboardHTML('<span data-buffer="&lt;!--(figma)payload(/figma)--&gt;"></span>')
    ).toBe(true)
  })

  test('rejects malformed repeated opening markers in bounded time', () => {
    expect(isDesignClipboardHTML('ordinary clipboard text')).toBe(false)
    const malformed = '<!--(openpencil)'.repeat(10_000)
    const startedAt = performance.now()

    expect(isDesignClipboardHTML(malformed)).toBe(false)
    expect(performance.now() - startedAt).toBeLessThan(50)
  })
})
