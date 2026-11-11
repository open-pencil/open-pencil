import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createAutomationEvalHandler } from '@/app/automation/bridge/eval-handler'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import { createAutomationToolHandler } from '@/app/automation/bridge/tool-handlers'
import { acquireDocumentEdit } from '@/app/automation/execution/lock'
import { createEditorStore } from '@/app/editor/session/create'

import {
  installAutomationGlobals,
  trackAutomationRenderer
} from '#tests/helpers/automation/renderer-lifecycle'

let store: ReturnType<typeof createEditorStore>
let tracker: ReturnType<typeof trackAutomationRenderer>
let restoreGlobals: () => void
let target: AutomationTarget

beforeEach(() => {
  restoreGlobals = installAutomationGlobals()
  store = createEditorStore(new SceneGraph())
  tracker = trackAutomationRenderer(store)
  target = {
    store,
    documentId: 'renderer-lifecycle',
    documentName: 'Document',
    pageId: store.state.currentPageId,
    pageName: 'Page'
  }
})

afterEach(() => {
  tracker.dispose()
  store.dispose()
  vi.restoreAllMocks()
  restoreGlobals()
})

const shape = {
  name: 'create_shape',
  args: { type: 'RECTANGLE', x: 0, y: 0, width: 40, height: 20 }
}

describe('automation request renderer subscriptions', () => {
  test('repeated tools release subscriptions and preserve their undo steps', async () => {
    const handleTool = createAutomationToolHandler(tracker.makeFigma)
    const baseline = tracker.active
    for (let call = 0; call < 3; call++) {
      const pending = handleTool(target, shape)
      expect(tracker.active).toBeGreaterThan(baseline)
      expect(await pending).toMatchObject({ ok: true, result: { type: 'RECTANGLE' } })
      expect(tracker.active).toBe(baseline)
      expect(store.graph.getChildren(target.pageId)).toHaveLength(1)
      expect(store.undo.undo()).toBe('Agent: create_shape')
      expect(store.graph.getChildren(target.pageId)).toHaveLength(0)
    }
  })

  test('tool execution rejection releases its renderer subscription', async () => {
    const handleTool = createAutomationToolHandler((...args) => {
      const figma = tracker.makeFigma(...args)
      vi.spyOn(figma, 'getNodeByIdAsync').mockRejectedValue(new Error('Page unavailable'))
      return figma
    })
    const baseline = tracker.active
    const pending = handleTool(target, { name: 'get_node', args: { id: target.pageId } })
    expect(tracker.active).toBeGreaterThan(baseline)
    await expect(pending).rejects.toThrow('Page unavailable')
    expect(tracker.active).toBe(baseline)
    expect(store.undo.canUndo).toBe(false)
  })

  test('repeated eval mutations release subscriptions and remain undoable', async () => {
    const handleEval = createAutomationEvalHandler(tracker.makeFigma)
    const baseline = tracker.active
    for (let call = 0; call < 3; call++) {
      const pending = handleEval(target, {
        code: "const node = figma.createRectangle(); node.name = 'Script rectangle'; return node.name"
      })
      expect(tracker.active).toBeGreaterThan(baseline)
      expect(await pending).toEqual({ ok: true, result: 'Script rectangle' })
      expect(tracker.active).toBe(baseline)
      expect(store.graph.getChildren(target.pageId)).toHaveLength(1)
      expect(store.undo.undo()).toBe('Agent: eval')
      expect(store.graph.getChildren(target.pageId)).toHaveLength(0)
    }
  })

  test('eval compilation failure releases the subscription acquired before compilation', async () => {
    const handleEval = createAutomationEvalHandler(tracker.makeFigma)
    const baseline = tracker.active
    const acquired = tracker.acquired
    await expect(handleEval(target, { code: 'const =' })).rejects.toThrow()
    expect(tracker.acquired).toBeGreaterThan(acquired)
    expect(tracker.active).toBe(baseline)
    expect(store.undo.canUndo).toBe(false)
  })

  test('eval runtime rejection releases subscriptions and rolls back edits', async () => {
    const handleEval = createAutomationEvalHandler(tracker.makeFigma)
    const baseline = tracker.active
    const pending = handleEval(target, {
      code: "figma.createRectangle(); throw new Error('Script failed')"
    })
    expect(tracker.active).toBeGreaterThan(baseline)
    await expect(pending).rejects.toThrow('Script failed')
    expect(tracker.active).toBe(baseline)
    expect(store.graph.getChildren(target.pageId)).toHaveLength(0)
    expect(store.undo.canUndo).toBe(false)
  })

  test.each(['tool', 'eval'] as const)(
    '%s cancelled after API creation releases its subscription while the lock is held',
    async (kind) => {
      const release = await acquireDocumentEdit(store)
      const controller = new AbortController()
      const baseline = tracker.active
      const pending =
        kind === 'tool'
          ? createAutomationToolHandler(tracker.makeFigma)(target, shape, controller.signal)
          : createAutomationEvalHandler(tracker.makeFigma)(
              target,
              { code: 'figma.createRectangle()' },
              controller.signal
            )
      try {
        expect(tracker.active).toBeGreaterThan(baseline)
        await Promise.resolve()
        await Promise.resolve()
        controller.abort(new Error('Request cancelled'))
        await expect(pending).rejects.toThrow('Request cancelled')
        expect(tracker.active).toBe(baseline)
        expect(store.graph.getChildren(target.pageId)).toHaveLength(0)
        expect(store.undo.canUndo).toBe(false)
      } finally {
        controller.abort()
        release()
        await pending.catch(() => undefined)
      }
    }
  )
})
