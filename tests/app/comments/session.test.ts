import 'fake-indexeddb/auto'
import { afterEach, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { ALL_TOOLS } from '@open-pencil/core/tools'
import { readComments, writeComments, type CommentThread } from '@open-pencil/scene-graph'

import { executeWithPageUndo } from '@/app/automation/execution/editor'
import { useComments } from '@/app/comments/use'
import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session/create'

function thread(id: string, pageId = '0:1'): CommentThread {
  return {
    id,
    pageId,
    x: 0,
    y: 0,
    author: 'Ada',
    text: id,
    createdAt: '2026-10-08T10:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
    resolved: false,
    replies: []
  }
}

const ids = (list: CommentThread[]) => list.map((entry) => entry.id)

const stores: ReturnType<typeof createEditorStore>[] = []
afterEach(() => {
  for (const store of stores.splice(0)) store.dispose()
})

/** A fresh document made the active one, as opening a tab does. */
function openDocument() {
  const store = createEditorStore()
  stores.push(store)
  setActiveEditorStore(store)
  return store
}

/** Leave a comment the way the canvas does: a draft at a point, then its text. */
function comment(store: ReturnType<typeof openDocument>, x: number, y: number, text: string) {
  const comments = useComments()
  comments.startDraft({ pageId: store.state.currentPageId, x, y })
  comments.addThread(text)
  const added = comments.threads.value.at(-1)
  if (!added) throw new Error('No comment added')
  return added
}

test('a comment lands in the document it was written in, not the next one opened', () => {
  const first = openDocument()
  comment(first, 10, 10, 'mine')
  const second = openDocument()
  expect(useComments().threads.value).toEqual([])
  comment(second, 10, 10, 'other')

  expect(readComments(first.graph).map((entry) => entry.text)).toEqual(['mine'])
  expect(readComments(second.graph).map((entry) => entry.text)).toEqual(['other'])
})

test('making the same document active again keeps the open thread', () => {
  const store = openDocument()
  const added = comment(store, 10, 10, 'open me')
  expect(useComments().activeThreadId.value).toBe(added.id)

  // Panes of one tab take turns as the active one without switching documents.
  setActiveEditorStore(store)
  expect(useComments().activeThreadId.value).toBe(added.id)
})

test('commenting marks the document changed without adding an undo step', () => {
  const store = openDocument()
  store.markDocumentSaved()
  const canUndo = store.undo.canUndo

  comment(store, 10, 10, 'a')

  expect(store.hasUnsavedChanges()).toBe(true)
  expect(store.undo.canUndo).toBe(canUndo)
})

test('comments written to the document from elsewhere show up', async () => {
  const store = openDocument()
  writeComments(store.graph, [thread('x', store.state.currentPageId)])
  await Promise.resolve()

  expect(ids(useComments().threads.value)).toEqual(['x'])
})

test('a pin stays where its layer was when the layer is deleted, even if it was never drawn', async () => {
  const store = openDocument()
  const pageId = store.state.currentPageId
  const rect = store.graph.createNode('RECTANGLE', pageId, { x: 100, y: 50, width: 80, height: 40 })
  const pinned = comment(store, 110, 55, 'on the rectangle')
  expect(pinned.nodeId).toBe(rect.id)

  store.graph.updateNode(rect.id, { x: 300 })
  store.graph.deleteNode(rect.id)
  await Promise.resolve()

  const [detached] = readComments(store.graph)
  expect(detached?.nodeId).toBeNull()
  expect(detached && useComments().pinPosition(detached)).toEqual({ x: 310, y: 55 })
})

test('going to a comment opens its page and its thread', async () => {
  const store = openDocument()
  const first = store.state.currentPageId
  const added = comment(store, 40, 40, 'on page one')
  store.preparationController.acknowledgePresentation(Number.MAX_SAFE_INTEGER)
  await store.switchPage(store.graph.addPage('Second').id)
  expect(store.state.currentPageId).not.toBe(first)

  await useComments().focusThread(added.id)

  expect(store.state.currentPageId).toBe(first)
  expect(useComments().activeThreadId.value).toBe(added.id)
})

test('a collaborator’s save that lacks this session’s comment does not lose it', async () => {
  const store = openDocument()
  comment(store, 10, 10, 'mine')

  // Their copy was written before ours arrived, so it replaces the list whole.
  writeComments(store.graph, [thread('theirs', store.state.currentPageId)])
  await Promise.resolve()

  const texts = readComments(store.graph).map((entry) => entry.text)
  expect(texts.toSorted()).toEqual(['mine', 'theirs'])
  expect(useComments().threads.value).toHaveLength(2)
})

test('an agent’s comment is not an undo step either, as comments stay out of undo', async () => {
  const store = openDocument()
  const canUndo = store.undo.canUndo
  const figma = new FigmaAPI(store.graph)
  const addComment = ALL_TOOLS.find((tool) => tool.name === 'add_comment')
  if (!addComment) throw new Error('add_comment missing')

  await executeWithPageUndo(store, store.state.currentPageId, 'Agent: add_comment', () =>
    Promise.resolve(addComment.execute(figma, { text: 'Tighten the spacing', x: 4, y: 4 }))
  )
  await Promise.resolve()

  expect(useComments().threads.value).toHaveLength(1)
  expect(store.undo.canUndo).toBe(canUndo)
})
