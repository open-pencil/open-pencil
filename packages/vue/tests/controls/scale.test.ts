import { afterEach, describe, expect, test } from 'bun:test'

import { defineComponent, h, reactive } from 'vue'

import { createDefaultEditorState, createEditor, type Editor } from '@open-pencil/core'
import { SceneGraph } from '@open-pencil/scene-graph'
import { createTestRenderer, hostNode } from '@open-pencil/test-support/vue/renderer'
import { useScaleControls } from '@open-pencil/vue/controls/scale'

import { provideEditor } from '#vue/editor/context'

let editor: Editor
let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  editor.dispose()
})

/** The Scale panel's controls for a selected 200×100 frame with text inside. */
function mountScale() {
  // The app's state is reactive, so the panel follows the scene as it changes.
  const graph = new SceneGraph()
  editor = createEditor({ graph, state: reactive(createDefaultEditorState(graph.getPages()[0].id)) })
  const frame = editor.graph.createNode('FRAME', editor.state.currentPageId, {
    width: 200,
    height: 100
  })
  const text = editor.graph.createNode('TEXT', frame.id, { text: 'Hi', fontSize: 20 })
  editor.select([frame.id])
  let control: ReturnType<typeof useScaleControls> | undefined
  const Control = defineComponent({
    setup() {
      control = useScaleControls()
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
  if (!control) throw new Error('Expected the Scale controls')
  return { control, frame: frame.id, text: text.id }
}

function current(id: string) {
  const node = editor.graph.getNode(id)
  if (!node) throw new Error('missing layer')
  return node
}

describe('Scale panel controls', () => {
  test('a scrubbed width shows on the canvas at once and commits as one undo step', () => {
    const { control, frame, text } = mountScale()

    // The anchor starts at the center, so the box grows around it.
    control.previewSize('width', 300)
    expect(current(frame).width).toBe(300)
    expect(current(text).fontSize).toBe(30)
    control.previewSize('width', 400)
    expect(current(frame)).toMatchObject({ x: -100, y: -50, width: 400, height: 200 })

    control.commitSize('width', 400)
    expect(current(frame).width).toBe(400)
    editor.undo.undo()
    expect(current(frame)).toMatchObject({ x: 0, y: 0, width: 200 })
    expect(current(text).fontSize).toBe(20)
  })

  test('cancelling a scrub puts the layer back', () => {
    const { control, frame, text } = mountScale()
    control.previewFactor(2)
    expect(current(frame).width).toBe(400)
    control.cancel()
    expect(current(frame)).toMatchObject({ x: 0, y: 0, width: 200 })
    expect(current(text).fontSize).toBe(20)
  })

  test('a selection change mid-scrub puts the layers back at once and leaves the new ones alone', () => {
    const { control, frame } = mountScale()
    const other = editor.graph.createNode('RECTANGLE', editor.state.currentPageId, {
      x: 300,
      width: 50,
      height: 50
    })
    control.previewSize('width', 400)
    editor.select([other.id])
    expect(current(frame)).toMatchObject({ x: 0, y: 0, width: 200 })

    control.previewSize('width', 100)
    control.commitSize('width', 100)
    expect(current(frame).width).toBe(200)
    expect(current(other.id).width).toBe(100)
  })

  test('the factor counts from the size the selection had when picked', () => {
    const { control, frame } = mountScale()
    control.commitFactor(1.5)
    expect(control.factor.value).toBe(1.5)
    control.commitFactor(2)
    expect(current(frame).width).toBe(400)
  })
})
