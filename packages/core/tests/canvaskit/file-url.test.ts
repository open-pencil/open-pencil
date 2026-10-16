import { expect, test } from 'bun:test'

import { fileURLToPath } from '#core/canvaskit'

test('a Windows file URL becomes a path without a doubled drive letter', () => {
  expect(fileURLToPath('file:///C:/Users/me/node_modules/canvaskit-wasm/bin/canvaskit.wasm')).toBe(
    'C:/Users/me/node_modules/canvaskit-wasm/bin/canvaskit.wasm'
  )
})

test('a POSIX file URL keeps its leading slash and decodes spaces', () => {
  expect(fileURLToPath('file:///home/me/my%20app/canvaskit.wasm')).toBe(
    '/home/me/my app/canvaskit.wasm'
  )
})

test('a network share file URL keeps its host', () => {
  expect(fileURLToPath('file://server/share/canvaskit.wasm')).toBe('//server/share/canvaskit.wasm')
})
