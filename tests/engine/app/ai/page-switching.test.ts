import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'
import { createAITools } from '@/app/ai/tools'
import { createEditorStore } from '@/app/editor/session'

type AdapterTool = { execute(args: Record<string, unknown>): Promise<unknown> }

describe('AI page switching', () => {
  beforeEach(() => {
    globalThis.window = { innerWidth: 1024, innerHeight: 768 } as Window & typeof globalThis
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  test('updates the editor page used by the interface and following tools', async () => {
    const store = createEditorStore()
    try {
      const secondPage = store.graph.addPage('Second')
      const tools = createAITools(store)

      await (tools.switch_page as AdapterTool).execute({ page: secondPage.id })

      expect(store.state.currentPageId).toBe(secondPage.id)
      const pages = (await (tools.list_pages as AdapterTool).execute({})) as {
        current: { id: string }
      }
      expect(pages.current.id).toBe(secondPage.id)
    } finally {
      store.dispose()
    }
  })
})
