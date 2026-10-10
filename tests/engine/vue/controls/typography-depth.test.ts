import { describe, expect, test } from 'bun:test'

import { computed } from 'vue'

import { createEditor } from '@open-pencil/core/editor'

import { createTypographyActions } from '#vue/controls/typography/actions'

describe('typography depth actions', () => {
  test('restores nullable max lines and text style after preview undo', () => {
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      maxLines: null,
      textStyleId: '1:20'
    })
    const nodes = computed(() =>
      [editor.graph.getNode(text.id)].filter((node) => node !== undefined)
    )
    const actions = createTypographyActions({
      editor,
      nodes,
      activeFormatting: computed(() => []),
      options: {}
    })

    actions.updateProp('maxLines', 3)
    actions.commitProp('maxLines', 3, 1)
    expect(editor.graph.getNode(text.id)).toMatchObject({ maxLines: 3, textStyleId: '1:20' })

    editor.undo.undo()
    expect(editor.graph.getNode(text.id)).toMatchObject({ maxLines: null, textStyleId: '1:20' })
  })

  test('updates OpenType features and detaches text styles in one undo step', () => {
    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      fontFeatures: [{ tag: 'kern', enabled: true }],
      textStyleId: '1:21'
    })
    const actions = createTypographyActions({
      editor,
      nodes: computed(() => [editor.graph.getNode(text.id)].filter((node) => node !== undefined)),
      activeFormatting: computed(() => []),
      options: {}
    })

    actions.setFontFeature('LIGA', false)
    expect(editor.graph.getNode(text.id)).toMatchObject({
      fontFeatures: [
        { tag: 'kern', enabled: true },
        { tag: 'LIGA', enabled: false }
      ],
      textStyleId: null
    })
    editor.undo.undo()
    expect(editor.graph.getNode(text.id)).toMatchObject({
      fontFeatures: [{ tag: 'kern', enabled: true }],
      textStyleId: '1:21'
    })
  })

  // Figma desktop 126 edits every selected text when several are selected.
  test('changes every text layer in one undo step', () => {
    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('TEXT', pageId, { textCase: 'ORIGINAL' })
    const second = editor.graph.createNode('TEXT', pageId, { textCase: 'LOWER' })
    const actions = createTypographyActions({
      editor,
      nodes: computed(() =>
        [first.id, second.id]
          .map((id) => editor.graph.getNode(id))
          .filter((node) => node !== undefined)
      ),
      activeFormatting: computed(() => []),
      options: {}
    })

    actions.setTextCase('UPPER')
    expect([first.id, second.id].map((id) => editor.graph.getNode(id)?.textCase)).toEqual([
      'UPPER',
      'UPPER'
    ])
    editor.undo.undo()
    expect([first.id, second.id].map((id) => editor.graph.getNode(id)?.textCase)).toEqual([
      'ORIGINAL',
      'LOWER'
    ])
  })
})
