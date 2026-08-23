import { afterEach, describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import type { EditorStore } from '@/app/editor/active-store'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

describe('automation Figma factory', () => {
  test('forwards the targeted page when exporting an image', async () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { innerWidth: 1280, innerHeight: 720 }
    })
    const graph = new SceneGraph()
    const setup = new FigmaAPI(graph)
    const targetPage = setup.createPage()
    setup.currentPage = targetPage
    const frame = setup.createFrame()
    const calls: Array<{ ids: string[]; pageId?: string }> = []
    const store = {
      graph,
      renderer: null,
      state: {
        currentPageId: graph.getPages()[0]?.id ?? graph.rootId,
        selectedIds: new Set<string>(),
        panX: 0,
        panY: 0,
        zoom: 1
      },
      renderExportImage: async (
        ids: string[],
        _scale: number,
        _format: string,
        pageId?: string
      ) => {
        calls.push({ ids, pageId })
        return new Uint8Array([1])
      }
    } as unknown as EditorStore
    const figma = makeFigmaFromStore(store, targetPage.id)

    await figma.exportImage?.([frame.id], { format: 'PNG' })

    expect(calls).toEqual([{ ids: [frame.id], pageId: targetPage.id }])
  })
})
