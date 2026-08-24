import { describe, expect, test } from 'bun:test'

import { FigmaAPI, SceneGraph } from '@open-pencil/core'

import type { AutomationTarget } from '@/app/automation/bridge/target'
import {
  prepareRasterExportTarget,
  syncPageSwitchToEditor
} from '@/app/automation/bridge/tool-handlers'
import type { EditorStore } from '@/app/editor/active-store'

function setupTarget() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const initialPage = figma.currentPage
  const requestedPage = figma.createPage()
  requestedPage.name = 'Requested page'
  figma.currentPage = requestedPage
  const frame = figma.createFrame()
  figma.currentPage = initialPage
  const switchedPages: string[] = []
  const store = {
    graph,
    state: { currentPageId: initialPage.id },
    switchPage: async (pageId: string) => {
      switchedPages.push(pageId)
      store.state.currentPageId = pageId
    }
  } as unknown as EditorStore
  const target: AutomationTarget = {
    store,
    documentId: 'tab-1',
    documentName: 'Document',
    pageId: initialPage.id,
    pageName: initialPage.name
  }
  return { frame, initialPage, requestedPage, switchedPages, target }
}

describe('automation raster export target', () => {
  test('switches and loads the explicitly requested page before export', async () => {
    const { requestedPage, switchedPages, target } = setupTarget()
    target.pageId = requestedPage.id

    await prepareRasterExportTarget(target, {})

    expect(switchedPages).toEqual([requestedPage.id])
    expect(target.pageName).toBe('Requested page')
  })

  test('infers and switches to the owning page when only a node ID is requested', async () => {
    const { frame, requestedPage, switchedPages, target } = setupTarget()

    await prepareRasterExportTarget(target, { ids: [frame.id] })

    expect(target.pageId).toBe(requestedPage.id)
    expect(switchedPages).toEqual([requestedPage.id])
  })
})

describe('automation page switching', () => {
  test('synchronizes switch_page with the visible editor state', async () => {
    const { requestedPage, switchedPages, target } = setupTarget()
    const figma = new FigmaAPI(target.store.graph)
    figma.currentPage = requestedPage

    const synced = await syncPageSwitchToEditor(target, figma, {
      id: requestedPage.id,
      page: requestedPage.name
    })

    expect(synced).toBe(true)
    expect(switchedPages).toEqual([requestedPage.id])
    expect(target.pageId).toBe(requestedPage.id)
    expect(target.pageName).toBe('Requested page')
  })
})
