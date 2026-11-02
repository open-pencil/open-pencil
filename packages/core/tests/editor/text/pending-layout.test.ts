import { afterEach, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core'
import { setTextMeasurer } from '@open-pencil/core/layout'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  createPendingTextLayout,
  type PendingLayoutRenderer
} from '#core/editor/text/pending-layout'
import { createLayoutRunner } from '#core/layout/mutations'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'

afterEach(() => {
  setTextMeasurer(null)
})

/**
 * A Hug row around auto-width text whose face loads after the first layout; `outside` puts the
 * text on the page instead, where only its own measurement sizes it.
 */
function setup({ outside = false, text: values = {} }: { outside?: boolean; text?: Partial<SceneNode> } = {}) {
  const editor = createEditor()
  const graph = editor.graph
  const frame = graph.createNode('FRAME', editor.state.currentPageId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12
  })
  const text = graph.createNode('TEXT', outside ? editor.state.currentPageId : frame.id, {
    text: 'Weighted label',
    fontWeight: 900,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    ...values
  })
  let loaded = false
  const renderer: PendingLayoutRenderer = {
    fontsLoaded: true,
    measureTextNode: () => (loaded ? { width: 234, height: 29 } : null)
  }
  const { runLayoutForNode } = createLayoutRunner(() => graph)
  let renders = 0
  /** Whether each layout the pending text ran was the document's own. */
  const relayouts: boolean[] = []
  const pending = createPendingTextLayout({
    getGraph: () => graph,
    runLayoutForNode: (id) => {
      relayouts.push(graph.isApplyingDerivedLayout)
      runLayoutForNode(id)
    },
    requestRender: () => renders++,
    isReady: () => loaded
  })
  setTextMeasurer((node, maxWidth) => pending.measure(renderer, node, maxWidth))
  const load = () => {
    loaded = true
    pending.relayoutReady(renderer)
  }
  return {
    editor,
    graph,
    frame,
    text,
    renderer,
    pending,
    runLayoutForNode,
    load,
    relayouts,
    renders: () => renders
  }
}

test('text laid out before its face loads takes its size, and its Hug frame follows', () => {
  const { editor, frame, text, runLayoutForNode, load, relayouts, renders } = setup()
  runLayoutForNode(text.id)
  const estimated = text.width
  expect(estimated).not.toBe(234)

  load()
  expect([text.width, text.height]).toEqual([234, 29])
  expect([frame.width, frame.height]).toEqual([266, 53])
  expect(renders()).toBe(1)
  expect(relayouts).toEqual([false])
  expect(editor.undo.canUndo).toBe(false)
})

test('a face that loads keeps the layout of the document’s own state derived', () => {
  const { graph, text, runLayoutForNode, load, relayouts } = setup()
  graph.applyDerivedLayoutDuring(() => runLayoutForNode(text.id))
  load()
  expect(text.width).toBe(234)
  expect(relayouts).toEqual([true])
})

test('layers whose faces are still loading or that were removed are left alone', () => {
  const { graph, text, pending, renderer, runLayoutForNode, renders } = setup()
  runLayoutForNode(text.id)
  pending.relayoutReady(renderer)
  expect(renders()).toBe(0)
  graph.deleteNode(text.id)
  pending.relayoutReady(renderer)
  expect(renders()).toBe(0)
})

/** Edits the text as the editor and the plugin API do, measuring it as it changes. */
function edit(graph: ReturnType<typeof setup>['graph'], text: SceneNode, changes: Partial<SceneNode>) {
  graph.updateNode(text.id, { ...changes, ...textAutoResizeChanges(text, changes) })
}

test('text outside auto layout edited before its face loads takes its size when it loads', () => {
  const { graph, text, load, editor } = setup({ outside: true })
  edit(graph, text, { text: 'Heavier label' })
  expect(text.width).not.toBe(234)

  load()
  expect([text.width, text.height]).toEqual([234, 29])
  expect(editor.undo.canUndo).toBe(false)
})

test('wrapping text outside auto layout takes its height when its face loads', () => {
  const { graph, text, load } = setup({ outside: true, text: { textAutoResize: 'HEIGHT', width: 200 } })
  edit(graph, text, { text: 'Heavier label' })
  load()
  expect([text.width, text.height]).toEqual([200, 29])
})

test('text that keeps the glyphs its file saved keeps the size the file gave it', () => {
  const { graph, text, runLayoutForNode, load } = setup({
    outside: true,
    text: {
      width: 120,
      height: 20,
      derivedTextGlyphs: [{ commandsBlob: new Uint8Array(), x: 0, y: 16, fontSize: 16, firstCharacter: 0 }]
    }
  })
  graph.applyDerivedLayoutDuring(() => runLayoutForNode(text.id))
  // Measured while it loads, as layout measures text in a flow, without changing it.
  graph.applyDerivedLayoutDuring(() => textAutoResizeChanges(text, { text: text.text }))
  load()
  expect([text.width, text.height]).toEqual([120, 20])
})
