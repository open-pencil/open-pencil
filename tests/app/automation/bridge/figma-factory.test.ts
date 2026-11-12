import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { getCanvasKit } from '@open-pencil/core/canvaskit'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { createAutomationCommandHandlers } from '@/app/automation/bridge/handlers'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createEditorStore, type EditorStore } from '@/app/editor/session/create'

const { handleTargetCommand } = createAutomationCommandHandlers(makeFigmaFromStore)

let store: EditorStore | undefined

beforeEach(() => {
  // The automation FigmaAPI reads the viewport size from the window; edited layers flash, and
  // nothing draws frames here.
  Object.assign(globalThis, {
    window: { innerWidth: 1024, innerHeight: 768 },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined
  })
})

afterEach(() => {
  store?.dispose()
  store = undefined
  vi.restoreAllMocks()
  for (const key of ['window', 'requestAnimationFrame', 'cancelAnimationFrame'])
    Reflect.deleteProperty(globalThis, key)
})

async function canvasRenderer(): Promise<SkiaRenderer> {
  const ck = await getCanvasKit()
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  return new SkiaRenderer(ck, surface)
}

async function storeWithCanvas(): Promise<EditorStore> {
  const created = createEditorStore()
  store = created
  const renderer = await canvasRenderer()
  created.setCanvasKit(renderer.ck, renderer)
  return created
}

function target(editor: EditorStore): AutomationTarget {
  return {
    store: editor,
    documentId: 'tab-1',
    documentName: 'Document',
    pageId: editor.state.currentPageId,
    pageName: 'Page 1'
  }
}

describe('automation Figma API', () => {
  test('agent calls measure with the canvas renderer and leave no graph listeners', async () => {
    const editor = await storeWithCanvas()
    // The graph's own edit recorders start with its first API.
    expect(makeFigmaFromStore(editor).renderer).toBe(editor.renderer)
    // Each edit listens while it records; what an API leaves behind stays after the calls.
    let listening = 0
    const subscribe = editor.graph.onNodeEvents.bind(editor.graph)
    vi.spyOn(editor.graph, 'onNodeEvents').mockImplementation((handlers) => {
      const unsubscribe = subscribe(handlers)
      listening++
      return () => {
        listening--
        unsubscribe()
      }
    })

    for (let call = 0; call < 3; call++) {
      await handleTargetCommand(target(editor), 'tool', {
        name: 'create_shape',
        args: { type: 'RECTANGLE', x: call * 50, y: 0, width: 40, height: 20 }
      })
      await handleTargetCommand(target(editor), 'eval', {
        code: 'figma.createEllipse().resize(10, 10)'
      })
    }

    expect(editor.graph.getChildren(editor.state.currentPageId)).toHaveLength(6)
    expect(listening).toBe(0)
  })

  test('a script measures with the renderer the canvas has when it reads', async () => {
    const editor = await storeWithCanvas()
    const figma = makeFigmaFromStore(editor)
    const first = editor.renderer
    const next = await canvasRenderer()

    editor.setCanvasKit(next.ck, next)
    if (first) editor.removeCanvasRenderer(first)

    expect(figma.renderer).toBe(next)
  })
})
