import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { SceneGraph } from '@open-pencil/scene-graph'

describe('editor page events', () => {
  test('emits page ready only after the switched page finishes loading fonts', async () => {
    const graph = new SceneGraph()
    const nextPage = graph.addPage('Next')
    graph.createNode('TEXT', nextPage.id, {
      text: 'Presenter slide',
      fontFamily: 'Presenter Test Font'
    })

    let resolveFont: (value: ArrayBuffer | null) => void = () => undefined
    const fontLoaded = new Promise<ArrayBuffer | null>((resolve) => {
      resolveFont = resolve
    })
    const editor = createEditor({ graph, loadFont: () => fontLoaded })
    const events: string[] = []
    editor.onEditorEvent('page:changed', () => events.push('changed'))
    editor.onEditorEvent('page:ready', () => events.push('ready'))

    const switching = editor.switchPage(nextPage.id)
    await Promise.resolve()

    expect(events).toEqual(['changed'])

    resolveFont(null)
    await switching

    expect(events).toEqual(['changed', 'ready'])
  })
})
