import { expect, spyOn, test } from 'bun:test'

import { computed } from 'vue'

import { createEditor } from '@open-pencil/core'
import { fontManager } from '@open-pencil/core/text'

import { createTypographyActions } from '#vue/controls/typography/actions'

test('a face the browser lists under other names is saved by its own font’s names', async () => {
  // As Edge on Windows lists Segoe UI Variable's "Bold Display" once its file is read.
  const ownFaceName = spyOn(fontManager, 'ownFaceName').mockImplementation((family, style) =>
    family === 'Segoe UI Variable Display' && style === 'Bold'
      ? { family: 'Segoe UI Variable', style: 'Bold Display' }
      : null
  )
  try {
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'a',
      fontWeight: 700
    })
    const actions = createTypographyActions({
      editor,
      nodes: computed(() => [text]),
      activeFormatting: computed(() => []),
      supports: () => true,
      options: { fontLoader: { load: () => Promise.resolve() } }
    })
    await actions.setFamily('Segoe UI Variable Display')
    expect([text.fontFamily, text.fontStyle, text.fontWeight]).toEqual([
      'Segoe UI Variable',
      'Bold Display',
      700
    ])
    await actions.setFamily('Lora')
    expect([text.fontFamily, text.fontStyle, text.fontWeight]).toEqual(['Lora', null, 700])
  } finally {
    ownFaceName.mockRestore()
  }
})
