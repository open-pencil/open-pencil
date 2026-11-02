import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'

test('tells listeners each face that loads, however it was asked for', async () => {
  const editor = createEditor()
  const loaded: string[] = []
  editor.onEditorEvent('font:loaded', (family, style) => loaded.push(`${family} ${style}`))
  try {
    // As a paste or a script loads a face, past the renderer's font resolver.
    await fontManager.markLoaded('Font Events Sans', 'Bold', new ArrayBuffer(8))
    expect(loaded).toEqual(['Font Events Sans Bold'])
  } finally {
    editor.dispose()
  }
  // A disposed editor no longer hears of loads.
  await fontManager.markLoaded('Font Events Sans', 'Light', new ArrayBuffer(8))
  expect(loaded).toEqual(['Font Events Sans Bold'])
})
