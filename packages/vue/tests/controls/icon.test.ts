import { afterEach, describe, expect, test } from 'bun:test'

import { defineComponent, h, reactive } from 'vue'

import { createDefaultEditorState, createEditor, type Editor } from '@open-pencil/core'
import { tintedIconPath, type IconData, type IconProvider } from '@open-pencil/core/icons'
import { SceneGraph } from '@open-pencil/scene-graph'
import { readIcon } from '@open-pencil/scene-graph/icons'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'
import { useIcon } from '@open-pencil/vue/controls/icon'

import { provideEditor } from '#vue/editor/context'

let editor: Editor
let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  editor.dispose()
})

/**
 * The Icon section's controls for a selected icon from a set that records its weight, whose bold
 * drawing waits until `release` is called.
 */
async function mountIcon() {
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const icons: IconProvider = {
    search: async () => ({ icons: [], total: 0, collections: {} }),
    collections: async () => [],
    browse: async () => [],
    previews: async () => new Map(),
    async icons(names, size, options) {
      const weight = options?.weight ?? 'regular'
      if (weight === 'bold') await held
      return new Map(
        names.map((name): [string, IconData] => [
          name,
          {
            prefix: 'test',
            name: name.slice(name.indexOf(':') + 1),
            width: size,
            height: size,
            paths: [tintedIconPath(parseSVGPath('M2 2L22 2L22 22Z', 'NONZERO'))],
            options: { weight }
          }
        ])
      )
    }
  }
  const graph = new SceneGraph()
  editor = createEditor({
    graph,
    state: reactive(createDefaultEditorState(graph.getPages()[0].id)),
    icons,
    getViewportSize: () => ({ width: 1000, height: 800 })
  })
  const id = await editor.insertIcon('test:square')
  if (!id) throw new Error('Expected an icon')
  let control: ReturnType<typeof useIcon> | undefined
  const Control = defineComponent({
    setup() {
      control = useIcon()
      return () => h('div')
    }
  })
  const app = createTestRenderer().createApp(
    defineComponent({
      setup() {
        provideEditor(editor)
        return () => h(Control)
      }
    })
  )
  app.mount(hostNode())
  unmount = () => app.unmount()
  if (!control) throw new Error('Expected the Icon controls')
  return { control, id, release: () => release() }
}

describe('Icon section controls', () => {
  test('an option set back while the icon is still drawing the last value is set back', async () => {
    const { control, id, release } = await mountIcon()
    const bold = control.setOption('weight', 'bold')
    const back = control.setOption('weight', 'regular')
    release()
    await Promise.all([bold, back])
    const node = editor.graph.getNode(id)
    expect(node && readIcon(node)?.options).toEqual({ weight: 'regular' })
  })
})
