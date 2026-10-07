import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { exportFigFile, parseFigFile } from '@open-pencil/core/io'
import { populateFigPage } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/core/kiwi'
import { SceneGraph } from '@open-pencil/scene-graph'

import type { PageSwitchProgress } from '#core/editor/pages'

test('core page preparation only reports progress and never owns app suspension', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('Expected default page')
  graph.createNode('TEXT', page.id, {
    text: 'Loading',
    fontFamily: 'Loader Test',
    fontWeight: 400
  })
  const progress: PageSwitchProgress[] = []
  let release: () => void = () => undefined
  const fontReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async () => {
      await fontReady
      return null
    }
  })
  const switching = editor.switchPage(page.id, {
    onProgress: (next) => progress.push(next)
  })
  await Promise.resolve()

  expect(progress.some((entry) => entry.phase === 'resolving-fonts')).toBe(true)
  release()
  await switching
  expect(progress).toContainEqual(
    expect.objectContaining({ phase: 'resolving-fonts', completed: 1, total: 1 })
  )
})

test('prepares a target page without exposing it before commit', async () => {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  if (!firstPage) throw new Error('Expected default page')
  const secondPage = graph.addPage('Prepared page')
  graph.createNode('TEXT', secondPage.id, {
    text: 'Loading',
    fontFamily: 'Loader Test',
    fontWeight: 400
  })
  let release: () => void = () => undefined
  const fontReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async () => {
      await fontReady
      return null
    }
  })
  const pageChanges: string[] = []
  editor.onEditorEvent('page:changed', (pageId) => pageChanges.push(pageId))

  const preparing = editor.preparePage(secondPage.id)
  await Promise.resolve()
  expect(editor.state.currentPageId).toBe(firstPage.id)
  expect(pageChanges).toEqual([])

  release()
  const prepared = await preparing
  expect(editor.state.currentPageId).toBe(firstPage.id)
  expect(prepared).not.toBeNull()
  if (!prepared) throw new Error('Expected prepared page')

  expect(editor.commitPageSwitch(prepared)).toBe(true)
  expect(editor.state.currentPageId).toBe(secondPage.id)
  expect(pageChanges).toEqual([secondPage.id])
})

test('aborted page preparation preserves the visible page', async () => {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  if (!firstPage) throw new Error('Expected default page')
  const secondPage = graph.addPage('Cancelled page')
  graph.createNode('TEXT', secondPage.id, {
    text: 'Loading',
    fontFamily: 'Loader Test',
    fontWeight: 400
  })
  let release: () => void = () => undefined
  const fontReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async () => {
      await fontReady
      return null
    }
  })
  const abort = new AbortController()
  const preparing = editor.preparePage(secondPage.id, { signal: abort.signal })
  await Promise.resolve()
  abort.abort()
  release()

  await expect(preparing).rejects.toHaveProperty('name', 'AbortError')
  expect(editor.state.currentPageId).toBe(firstPage.id)
})

test('obsolete prepared pages cannot commit after a newer preparation', async () => {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  if (!firstPage) throw new Error('Expected default page')
  const secondPage = graph.addPage('Second')
  const thirdPage = graph.addPage('Third')
  const editor = createEditor({ graph, skipInitialGraphSetup: true })

  const second = await editor.preparePage(secondPage.id)
  const third = await editor.preparePage(thirdPage.id)
  expect(second).not.toBeNull()
  expect(third).not.toBeNull()
  if (!second || !third) throw new Error('Expected prepared pages')

  expect(editor.commitPageSwitch(second)).toBe(false)
  expect(editor.state.currentPageId).toBe(firstPage.id)
  expect(editor.commitPageSwitch(third)).toBe(true)
  expect(editor.state.currentPageId).toBe(thirdPage.id)
})
test('page viewport cleanup remains independent from app preparation state', () => {
  const editor = createEditor()

  expect(() => editor.clearPageViewports()).not.toThrow()
})

test('loading page nodes for a lookup does not supersede a page switch in progress', async () => {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  if (!firstPage) throw new Error('Expected default page')
  const target = graph.addPage('Target')
  const searched = graph.addPage('Searched')
  graph.createNode('TEXT', target.id, { text: 'Loading', fontFamily: 'Loader Test' })
  let release: () => void = () => undefined
  const fontReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async () => {
      await fontReady
      return null
    }
  })

  const switching = editor.switchPage(target.id)
  await Promise.resolve()
  await editor.loadPageNodes(searched.id)
  release()
  await switching

  expect(editor.state.currentPageId).toBe(target.id)
})

test('preparing a page for rendering loads its fonts and layout once without switching to it', async () => {
  const graph = new SceneGraph()
  const firstPage = graph.getPages()[0]
  if (!firstPage) throw new Error('Expected default page')
  const target = graph.addPage('Target')
  const prepared = graph.addPage('Prepared')
  graph.createNode('TEXT', target.id, { text: 'Loading', fontFamily: 'Loader Test' })
  const row = graph.createNode('FRAME', prepared.id, {
    width: 10,
    height: 10,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED'
  })
  graph.createNode('FRAME', row.id, { width: 30, height: 10 })
  graph.createNode('TEXT', prepared.id, { text: 'Label', fontFamily: 'Prepared Font' })
  const loaded: string[] = []
  let release: () => void = () => undefined
  const fontReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async (family) => {
      loaded.push(family)
      if (family === 'Loader Test') await fontReady
      return null
    }
  })

  const switching = editor.switchPage(target.id)
  await Promise.resolve()
  const concurrent = await Promise.all([
    editor.preparePageNodes(prepared.id),
    editor.preparePageNodes(prepared.id)
  ])
  const again = await editor.preparePageNodes(prepared.id)
  release()
  await switching

  expect([...concurrent, again]).toEqual([true, true, true])
  expect(loaded.filter((family) => family === 'Prepared Font')).toHaveLength(1)
  expect(graph.getNode(row.id)?.width).toBe(30)
  expect(editor.state.currentPageId).toBe(target.id)
})

test('preparing a page reports failure when the document is replaced meanwhile', async () => {
  const graph = new SceneGraph()
  const page = graph.addPage('Prepared')
  graph.createNode('TEXT', page.id, { text: 'Label', fontFamily: 'Prepared Font' })
  let release: () => void = () => undefined
  const fontReady = new Promise<void>((resolve) => {
    release = resolve
  })
  const editor = createEditor({
    graph,
    skipInitialGraphSetup: true,
    loadFont: async () => {
      await fontReady
      return null
    }
  })

  const preparing = editor.preparePageNodes(page.id)
  await Promise.resolve()
  editor.replaceGraph(new SceneGraph())
  release()

  expect(await preparing).toBe(false)
})

test("loading a page's layers from the opened file asks for one render", async () => {
  await initCodec()
  const source = new SceneGraph()
  const second = source.addPage('Second')
  for (let i = 0; i < 30; i++) source.createNode('RECTANGLE', second.id, { name: `Layer ${i}` })
  const bytes = await exportFigFile(source)
  const graph = await parseFigFile(bytes.slice().buffer, { populate: 'first-page' })
  const editor = createEditor({ graph })
  const page = graph.getPages()[1]
  if (!page) throw new Error('Expected a second page')
  await Promise.resolve()

  let renders = 0
  const unbind = editor.onEditorEvent('render:requested', () => renders++)
  expect(populateFigPage(graph, page.id)).toBe(true)
  await Promise.resolve()
  unbind()

  expect(graph.getChildren(page.id)).toHaveLength(30)
  expect(renders).toBe(1)
  editor.dispose()
})
