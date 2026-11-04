import { describe, expect, test } from 'bun:test'

import { servesRuntimeAsset, unservedRuntimeAssetMessage } from '#core/runtime-assets/served'

function response(status: number, contentType: string): Response {
  return new Response(status === 204 ? null : 'body', {
    status,
    headers: { 'content-type': contentType }
  })
}

describe('runtime assets', () => {
  test('a file is served when it answers with itself, not an error or the fallback page', () => {
    expect(servesRuntimeAsset(response(200, 'application/wasm'))).toBe(true)
    expect(servesRuntimeAsset(response(200, 'font/ttf'))).toBe(true)
    expect(servesRuntimeAsset(response(200, 'text/html; charset=utf-8'))).toBe(false)
    expect(servesRuntimeAsset(response(200, 'Text/HTML; charset=utf-8'))).toBe(false)
    expect(servesRuntimeAsset(response(404, 'text/plain'))).toBe(false)
    expect(servesRuntimeAsset(response(204, 'font/ttf'))).toBe(false)
  })

  test('the message names the file, what answered, the plugin, and the locator', () => {
    expect(
      unservedRuntimeAssetMessage(
        'canvaskit.wasm',
        '/canvaskit.wasm',
        response(200, 'text/html'),
        'setCanvasKitLocator'
      )
    ).toBe(
      "canvaskit.wasm is not served at /canvaskit.wasm (it answered text/html). Add openPencil() from '@open-pencil/core/node/vite' to the Vite config, or serve the file and point Core at it with setCanvasKitLocator."
    )
    expect(
      unservedRuntimeAssetMessage('Inter.ttf', '/Inter.ttf', response(404, 'text/plain'), 'x')
    ).toContain('(it answered 404)')
    expect(
      unservedRuntimeAssetMessage('Inter.ttf', '/Inter.ttf', response(204, 'font/ttf'), 'x')
    ).toContain('(it answered 204)')
  })
})
