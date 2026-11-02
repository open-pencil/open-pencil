import { afterEach, expect, spyOn, test } from 'bun:test'
import { noop } from 'es-toolkit'

import { createEditor } from '@open-pencil/core'
import type { SkiaRenderer } from '@open-pencil/core/canvas'
import { setTextMeasurer, sizeAutoResizingText } from '@open-pencil/core/layout'
import type { SceneNode } from '@open-pencil/scene-graph'

import { expectDefined } from '#core-tests/helpers/assert'
import {
  createPendingTextLayout,
  type PendingLayoutRenderer
} from '#core/editor/text/pending-layout'
import { createLayoutRunner } from '#core/layout/mutations'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { fontManager } from '#core/text/font/manager'
import { fontResolver } from '#core/text/resolver'

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
  /** Whether the text's face was found nowhere, so it measures in the substitute it draws in. */
  let substituted = false
  let canvasLoaded: () => void = noop
  const renderer: PendingLayoutRenderer = {
    fontsLoaded: canvasFontsLoaded,
    measureTextNode: () => {
      if (loaded) return { width: 234, height: 29 }
      return substituted ? { width: 180, height: 24 } : null
    },
    nodeFontReadiness: () => {
      if (loaded) return 'ready'
      return substituted ? 'substituted' : 'pending'
    },
    whenFontsLoaded: () =>
      new Promise((resolve) => {
        canvasLoaded = () => {
          renderer.fontsLoaded = true
          resolve()
        }
      }),
    syncFontGeneration: noop
  }
  let currentGraph = graph
  const { runLayoutForNode } = createLayoutRunner(() => currentGraph)
  let renders = 0
  /** The text each preparation was asked for. */
  const prepared: string[][] = []
  /** Whether a preparation makes the fonts measure the text. */
  let preparing = true
  /** Holds each preparation until the test lets it finish, when set. */
  let gate: Promise<void> | null = null
  /** Whether the next preparation fails, as a font that cannot be fetched does. */
  let failing = false
  /** Whether each layout the pending text ran was the document's own. */
  const relayouts: boolean[] = []
  const pending = createPendingTextLayout({
    getGraph: () => currentGraph,
    getRenderer: () => renderer,
    prepareFonts: async (texts) => {
      prepared.push(texts.map((node) => node.id))
      await (gate ?? Promise.resolve())
      if (failing) {
        failing = false
        throw new Error('font unavailable')
      }
      if (preparing) loaded = true
    },
    runLayoutForNode: (id) => {
      relayouts.push(currentGraph.isApplyingDerivedLayout)
      runLayoutForNode(id)
    },
    requestRender: () => renders++,
    onEditorEvent: editor.onEditorEvent
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
    findNowhere: () => (substituted = true),
    failNextPreparation: () => (failing = true),
    /** Replaces the document, as opening another one does, and returns the new one. */
    replaceDocument: () => {
      pending.clear()
      currentGraph = createEditor().graph
      return currentGraph
    },
    /** Holds preparations until the returned function lets them finish. */
    holdPreparation: () => {
      let release: () => void = noop
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      gate = held
      return () => {
        if (gate === held) gate = null
        release()
      }
    }
  }
}

test('text laid out before its fonts are prepared stays hidden at its size, then takes its own', async () => {
  const { editor, graph, frame, text, prepared, runLayoutForNode, relayouts, renders } = setup()
  runLayoutForNode(text.id)
  expect([text.width, text.height]).toEqual([100, 20])
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(true)

  await settle()
  expect(prepared).toEqual([[text.id]])
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
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
  const { graph, text, prepared, runLayoutForNode, canvasLoaded } = setup({
    canvasFontsLoaded: false
  })
  runLayoutForNode(text.id)
  await settle()
  expect(prepared).toEqual([])
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(true)

  canvasLoaded()
  await settle()
  expect(prepared).toEqual([[text.id]])
  expect(text.width).toBe(234)
})

test('a document replaced before its text is prepared keeps its text as it is', async () => {
  const { graph, text, runLayoutForNode, replaceDocument, renders } = setup()
  runLayoutForNode(text.id)
  replaceDocument()
  await settle()
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
  expect(text.width).toBe(100)
  expect(renders()).toBe(0)
})

test('a document replaced while its text is prepared keeps its text as it is', async () => {
  const { graph, text, prepared, runLayoutForNode, replaceDocument, renders, holdPreparation } =
    setup()
  const release = holdPreparation()
  runLayoutForNode(text.id)
  await settle()
  expect(prepared).toEqual([[text.id]])
  replaceDocument()
  release()
  await settle()
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
  expect(text.width).toBe(100)
  expect(renders()).toBe(0)
})

test('text of the document that replaced another is laid out once its fonts are prepared', async () => {
  const { prepared, replaceDocument, renders } = setup()
  const opened = replaceDocument()
  const next = opened.createNode('TEXT', opened.getPages()[0].id, {
    text: 'Weighted label',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 100,
    height: 20
  })
  sizeAutoResizingText(opened, next.id)
  expect(fontManager.isNodeBlocked(opened, next.id)).toBe(true)

  await settle()
  expect(prepared).toEqual([[next.id]])
  expect(fontManager.isNodeBlocked(opened, next.id)).toBe(false)
  expect([next.width, next.height]).toEqual([234, 29])
  expect(renders()).toBe(1)
})

test('text an edit queues again while it is prepared stays hidden until it is prepared again', async () => {
  const { graph, text, prepared, runLayoutForNode, holdPreparation, stopPreparing } = setup()
  stopPreparing()
  const releaseFirst = holdPreparation()
  runLayoutForNode(text.id)
  await settle()
  const releaseSecond = holdPreparation()
  edit(graph, text, { text: 'Heavier label' })
  await settle()
  expect(prepared).toEqual([[text.id], [text.id]])

  releaseFirst()
  await settle()
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(true)

  releaseSecond()
  await settle()
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
})

test('text its prepared fonts still cannot measure shows, and is laid out once fonts settle', async () => {
  const { graph, text, prepared, pending, runLayoutForNode, stopPreparing, loadElsewhere } =
    setup()
  stopPreparing()
  runLayoutForNode(text.id)
  await settle()
  expect(prepared).toEqual([[text.id]])
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
  expect(text.width).toBe(100)

  loadElsewhere()
  pending.retryStalled()
  await settle()
  expect(prepared).toEqual([[text.id], [text.id]])
  expect(text.width).toBe(234)
})

test('text measured in a substitute is laid out in its own face once its family loads', async () => {
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable.ttf'),
    'bundled Inter font'
  )
  const { graph, text, prepared, runLayoutForNode, renders, findNowhere, loadElsewhere } = setup({
    text: { fontFamily: 'Pending Layout Substitute' }
  })
  findNowhere()
  runLayoutForNode(text.id)
  expect([text.width, text.height]).toEqual([180, 24])
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
  await settle()
  expect(prepared).toEqual([])

  loadElsewhere()
  // A face of a family it does not name leaves it as it is.
  await fontManager.markLoaded('Pending Layout Other', 'Regular', inter)
  await settle()
  expect(prepared).toEqual([])
  expect(text.width).toBe(180)

  await fontManager.markLoaded('Pending Layout Substitute', 'Regular', inter)
  await settle()
  expect(prepared).toEqual([[text.id]])
  expect([text.width, text.height]).toEqual([234, 29])
  expect(renders()).toBe(1)
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

/**
 * An editor with a renderer whose fonts measure its auto-sizing text only once `measure` is called;
 * the rest of the renderer stays absent, past what the editor's graph events and text layout reach.
 */
function editorSetup() {
  let measurable = false
  const editor = createEditor({ loadFont: () => Promise.resolve(null) })
  const tiledScene: Partial<SkiaRenderer['tiledScene']> = {
    invalidateNode: noop,
    invalidateStructure: noop
  }
  const renderer: Partial<SkiaRenderer> = {
    tiledScene: tiledScene as SkiaRenderer['tiledScene'],
    forgetNode: noop,
    invalidateVectorPath: noop,
    fontsLoaded: true,
    measureTextNode: () => (measurable ? { width: 234, height: 29 } : null),
    nodeFontReadiness: () => (measurable ? 'ready' : 'pending'),
    whenFontsLoaded: () => Promise.resolve(),
    syncFontGeneration: noop,
    invalidateNodePicture: noop
  }
  editor.setCanvasKit({} as Parameters<typeof editor.setCanvasKit>[0], renderer as SkiaRenderer)
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'Weighted label',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 100,
    height: 20
  })
  /** Settles when the pending text layout next asks for a render, once it has laid text out. */
  const laidOut = () =>
    new Promise<void>((resolve) => {
      const stop = editor.onEditorEvent('render:requested', () => {
        stop()
        resolve()
      })
    })
  return {
    editor,
    text,
    measure: () => (measurable = true),
    laidOut,
    /** Lays the text out before its fonts measure it, which stalls it. */
    stall: async () => {
      const first = laidOut()
      sizeAutoResizingText(editor.graph, text.id)
      await first
    },
    dispose: () => editor.removeCanvasRenderer(renderer as SkiaRenderer)
  }
}

test('the editor lays out text its fonts could not measure once font resolution settles', async () => {
  const { text, measure, laidOut, stall, dispose } = editorSetup()
  try {
    await stall()
    expect(text.width).toBe(100)

    measure()
    const relaid = laidOut()
    await fontResolver.demand({ key: 'pending-layout-test', candidates: [] })
    await relaid
    expect([text.width, text.height]).toEqual([234, 29])
  } finally {
    fontResolver.reset('pending-layout-test')
    dispose()
  }
})

test('the editor lays out text its fonts could not measure once a face loads', async () => {
  const inter = expectDefined(
    await fontManager.fetchBundledFont('/InterVariable.ttf'),
    'bundled Inter font'
  )
  const { text, measure, laidOut, stall, dispose } = editorSetup()
  try {
    await stall()
    expect(text.width).toBe(100)

    measure()
    // The face listener runs inside markLoaded, so the render it leads to is awaited after it.
    const relaid = laidOut()
    await fontManager.markLoaded('Pending Layout Test', 'Regular', inter)
    await relaid
    expect([text.width, text.height]).toEqual([234, 29])
  } finally {
    dispose()
  }
})

test('text whose fonts fail to load shows at its size, and is laid out once fonts settle', async () => {
  const { graph, text, pending, runLayoutForNode, renders, failNextPreparation } = setup()
  failNextPreparation()
  const warn = spyOn(console, 'warn').mockImplementation(noop)
  try {
    runLayoutForNode(text.id)
    await settle()
    expect(warn).toHaveBeenCalledTimes(1)
  } finally {
    warn.mockRestore()
  }
  expect(fontManager.isNodeBlocked(graph, text.id)).toBe(false)
  expect([text.width, text.height]).toEqual([100, 20])
  expect(renders()).toBe(1)

  pending.retryStalled()
  await settle()
  expect([text.width, text.height]).toEqual([234, 29])
})

test('text whose face loads while a failing preparation runs is laid out in it', async () => {
  const { text, runLayoutForNode, renders, failNextPreparation, holdPreparation, loadElsewhere } =
    setup()
  failNextPreparation()
  const release = holdPreparation()
  const warn = spyOn(console, 'warn').mockImplementation(noop)
  try {
    runLayoutForNode(text.id)
    await settle()
    loadElsewhere()
    release()
    await settle()
    expect(warn).toHaveBeenCalledTimes(1)
  } finally {
    warn.mockRestore()
  }
  expect([text.width, text.height]).toEqual([234, 29])
  expect(renders()).toBe(1)
})
