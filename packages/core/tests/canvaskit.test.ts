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

  test('a file URL with a host keeps it as a UNC prefix', () => {
    expect(
      filePathFromURL(
        new URL('file://server/share/node_modules/@open-pencil/canvaskit/dist/canvaskit.wasm')
      )
    ).toBe('\\\\server\\share\\node_modules\\@open-pencil\\canvaskit\\dist\\canvaskit.wasm')
    // `localhost` names the local machine, so the host is dropped as `fileURLToPath` does.
    expect(filePathFromURL(new URL('file://localhost/tmp/canvaskit.wasm'))).toBe(
      '/tmp/canvaskit.wasm'
    )
  })

  test('a literal percent in a path survives decoding', () => {
    expect(filePathFromURL(new URL('file:///tmp/100%25/open-pencil/canvaskit.wasm'))).toBe(
      '/tmp/100%/open-pencil/canvaskit.wasm'
    )
  })

  test('the default locator returns a filesystem path under Node, not a file URL', () => {
    const located = defaultCanvasKitLocator('canvaskit.wasm')
    expect(located.startsWith('file:')).toBe(false)
    // Build the expectation through the same conversion the locator uses, so a
    // UNC install (`file://server/share/...`) keeps its host instead of having
    // it discarded, and the suffix check accepts the UNC separator.
    const expected = filePathFromURL(
      new URL('canvaskit.wasm', import.meta.resolve('@open-pencil/canvaskit'))
    )
    expect(located).toBe(expected)
    expect(located.endsWith('/canvaskit.wasm') || located.endsWith('\\canvaskit.wasm')).toBe(true)
  })
})
