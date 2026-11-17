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
 * The Icon section's controls for a selected icon from a set that records its weight. Each bold
 * drawing waits until `release` lets the oldest waiting one through.
 */
async function mountIcon() {
  const waiting: (() => void)[] = []
  /** Lets the oldest bold drawing through, once one has begun loading. */
  async function release() {
    // Redraws load one at a time, so the next waits for the redraws queued before it.
    for (let turn = 0; waiting.length === 0 && turn < 50; turn++)
      await new Promise((resolve) => {
        setTimeout(resolve, 0)
      })
    const next = waiting.shift()
    if (!next) throw new Error('No bold drawing is loading')
    next()
  }
  const icons: IconProvider = {
    search: async () => ({ icons: [], total: 0, collections: {} }),
    collections: async () => [],
    browse: async () => [],
    previews: async () => new Map(),
    async icons(names, size, options) {
      const weight = options?.weight ?? 'regular'
      if (weight === 'bold')
        await new Promise<void>((resolve) => {
          waiting.push(resolve)
        })
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
  return { control, id, release }
}

describe('Icon section controls', () => {
  test('a value set back while a later request of the first value still draws is set back', async () => {
    const { control, id, release } = await mountIcon()
    const first = control.setOption('weight', 'bold')
    const back = control.setOption('weight', 'regular')
    const again = control.setOption('weight', 'bold')
    await release()
    await Promise.all([first, back])
    // `again` is still drawing bold, so regular differs from the last value asked for.
    const last = control.setOption('weight', 'regular')
    await release()
    await Promise.all([again, last])
    const node = editor.graph.getNode(id)
    expect(node && readIcon(node)?.options).toEqual({ weight: 'regular' })
  })

  test('an option set back while the icon is still drawing the last value is set back', async () => {
    const { control, id, release } = await mountIcon()
    const bold = control.setOption('weight', 'bold')
    const back = control.setOption('weight', 'regular')
    await release()
    await Promise.all([bold, back])
    const node = editor.graph.getNode(id)
    expect(node && readIcon(node)?.options).toEqual({ weight: 'regular' })
  })
})
