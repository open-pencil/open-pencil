import { describe, expect, test } from 'bun:test'

import { defaultCanvasKitLocator, filePathFromURL } from '#core/canvaskit'

describe('CanvasKit locator', () => {
  test('a file URL decodes spaces and accents to a filesystem path', () => {
    expect(
      filePathFromURL(
        new URL('file:///tmp/my%20folder/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm')
      )
    ).toBe('/tmp/my folder/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm')
    expect(
      filePathFromURL(
        new URL(
          'file:///tmp/op%C3%A7%C3%A3o/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm'
        )
      )
    ).toBe('/tmp/opção/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm')
  })

  test('a Windows file URL drops the leading slash before the drive letter', () => {
    expect(
      filePathFromURL(
        new URL(
          'file:///C:/Users/Jane%20Doe/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm'
        )
      )
    ).toBe('C:/Users/Jane Doe/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm')
  })

  test('a path without escapes, and a literal plus, are unchanged', () => {
    expect(filePathFromURL(new URL('file:///tmp/plain/canvaskit.wasm'))).toBe(
      '/tmp/plain/canvaskit.wasm'
    )
    expect(filePathFromURL(new URL('file:///tmp/a+b/canvaskit.wasm'))).toBe(
      '/tmp/a+b/canvaskit.wasm'
    )
  })

  test('the default locator returns a filesystem path under Node, not a file URL', () => {
    const located = defaultCanvasKitLocator('canvaskit.wasm')
    expect(located.startsWith('file:')).toBe(false)
    expect(located).not.toContain('%')
    expect(located.endsWith('/canvaskit.wasm')).toBe(true)
  })
})
