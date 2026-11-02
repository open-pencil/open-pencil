import { afterEach, expect, test } from 'bun:test'
import { noop } from 'es-toolkit'

import { createEditor } from '@open-pencil/core'
import { setTextMeasurer } from '@open-pencil/core/layout'
import type { SceneNode } from '@open-pencil/scene-graph'

import {
  createPendingTextLayout,
  type PendingLayoutRenderer
} from '#core/editor/text/pending-layout'
import { createLayoutRunner } from '#core/layout/mutations'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { fontManager } from '#core/text/font/manager'

afterEach(() => {
  setTextMeasurer(null)
})

/** Lets the pending preparation and the layout after it run. */
const settle = () => Bun.sleep(0)

/**
 * A Hug row around auto-width text whose fonts are prepared after the first layout; `outside` puts
 * the text on the page instead, where only its own measurement sizes it.
 */
function setup({
  outside = false,
  text: values = {},
  canvasFontsLoaded = true
}: { outside?: boolean; text?: Partial<SceneNode>; canvasFontsLoaded?: boolean } = {}) {
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
    width: 100,
    height: 20,
    ...values
  })
  let loaded = false
  let canvasLoaded: () => void = noop
  const renderer: PendingLayoutRenderer = {
    fontsLoaded: canvasFontsLoaded,
    measureTextNode: () => (loaded ? { width: 234, height: 29 } : null),
    whenFontsLoaded: () =>
      new Promise((resolve) => {
        canvasLoaded = () => {
          renderer.fontsLoaded = true
          resolve()
        }
      }),
    syncFontGeneration: noop
  }
  const { runLayoutForNode } = createLayoutRunner(() => graph)
  let renders = 0
  /** The text each preparation was asked for. */
  const prepared: string[][] = []
  /** Whether a preparation makes the fonts measure the text. */
  let preparing = true
  /** Whether each layout the pending text ran was the document's own. */
  const relayouts: boolean[] = []
  let currentGraph = graph
  const pending = createPendingTextLayout({
    getGraph: () => currentGraph,
    getRenderer: () => renderer,
    prepareFonts: async (texts) => {
      prepared.push(texts.map((node) => node.id))
      await Promise.resolve()
      if (preparing) loaded = true
    },
    runLayoutForNode: (id) => {
      relayouts.push(graph.isApplyingDerivedLayout)
      runLayoutForNode(id)
    },
    requestRender: () => renders++
  })
  setTextMeasurer((node, maxWidth) => pending.measure(renderer, node, maxWidth))
  return {
    editor,
    graph,
    frame,
    text,
    pending,
    prepared,
    runLayoutForNode,
    relayouts,
    renders: () => renders,
    canvasLoaded: () => canvasLoaded(),
    stopPreparing: () => (preparing = false),
    loadElsewhere: () => (loaded = true),
    replaceDocument: () => {
      currentGraph = createEditor().graph
      pending.clear()
    }
  }
}

test('text laid out before its fonts are prepared stays hidden at its size, then takes its own', async () => {
  const { editor, frame, text, prepared, runLayoutForNode, relayouts, renders } = setup()
  runLayoutForNode(text.id)
  expect([text.width, text.height]).toEqual([100, 20])
  expect(fontManager.isNodeBlocked(text.id)).toBe(true)

  await settle()
  expect(prepared).toEqual([[text.id]])
  expect(fontManager.isNodeBlocked(text.id)).toBe(false)
  expect([text.width, text.height]).toEqual([234, 29])
  expect([frame.width, frame.height]).toEqual([266, 53])
  expect(renders()).toBe(1)
  expect(relayouts.every((derived) => !derived)).toBe(true)
  expect(editor.undo.canUndo).toBe(false)
})

test('the layout of the document’s own state stays derived', async () => {
  const { graph, text, runLayoutForNode, relayouts } = setup()
  graph.applyDerivedLayoutDuring(() => runLayoutForNode(text.id))
  await settle()
  expect(text.width).toBe(234)
  expect(relayouts.every(Boolean)).toBe(true)
})

/** Edits the text as the editor and the plugin API do, measuring it as it changes. */
function edit(graph: ReturnType<typeof setup>['graph'], text: SceneNode, changes: Partial<SceneNode>) {
  graph.updateNode(text.id, { ...changes, ...textAutoResizeChanges(text, changes) })
}

test('an edit applies at once, and its text takes its size once its fonts are in', async () => {
  const { graph, text, editor } = setup({ outside: true })
  edit(graph, text, { text: 'Heavier label' })
  expect(text.text).toBe('Heavier label')
  expect([text.width, text.height]).toEqual([100, 20])

  await settle()
  expect([text.width, text.height]).toEqual([234, 29])
  expect(editor.undo.canUndo).toBe(false)
})

test('wrapping text takes its height once its fonts are in', async () => {
  const { graph, text } = setup({ outside: true, text: { textAutoResize: 'HEIGHT', width: 200 } })
  edit(graph, text, { text: 'Heavier label' })
  await settle()
  expect([text.width, text.height]).toEqual([200, 29])
})

test('text waits for the canvas’s own fonts before its fonts are prepared', async () => {
  const { text, prepared, runLayoutForNode, canvasLoaded } = setup({ canvasFontsLoaded: false })
  runLayoutForNode(text.id)
  await settle()
  expect(prepared).toEqual([])
  expect(fontManager.isNodeBlocked(text.id)).toBe(true)

  canvasLoaded()
  await settle()
  expect(prepared).toEqual([[text.id]])
  expect(text.width).toBe(234)
})

test('a document replaced while fonts are prepared keeps its text as it is', async () => {
  const { text, runLayoutForNode, replaceDocument, renders } = setup()
  runLayoutForNode(text.id)
  replaceDocument()
  await settle()
  expect(fontManager.isNodeBlocked(text.id)).toBe(false)
  expect(text.width).toBe(100)
  expect(renders()).toBe(0)
})

test('text its prepared fonts still cannot measure shows, and is laid out once fonts settle', async () => {
  const { text, prepared, pending, runLayoutForNode, stopPreparing, loadElsewhere } = setup()
  stopPreparing()
  runLayoutForNode(text.id)
  await settle()
  expect(prepared).toEqual([[text.id]])
  expect(fontManager.isNodeBlocked(text.id)).toBe(false)
  expect(text.width).toBe(100)

  loadElsewhere()
  pending.retryStalled()
  await settle()
  expect(prepared).toEqual([[text.id], [text.id]])
  expect(text.width).toBe(234)
})

test('text that keeps the glyphs its file saved keeps the size the file gave it', async () => {
  const { graph, text, runLayoutForNode } = setup({
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
  await settle()
  expect([text.width, text.height]).toEqual([120, 20])
})
