import { afterEach, expect, test } from 'bun:test'

import { setActiveEditorStore } from '@/app/editor/active-store'
import { createEditorStore } from '@/app/editor/session/create'
import { useLivePagesSource } from '@/app/live-pages/open'
import type { RouteInfo } from '@/app/live-pages/routes'
import { readLivePage } from '@/app/live-pages/schema'

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

const HOME: RouteInfo = { route: '/', file: 'pages/index.vue', params: [] }
const BLOG_POST: RouteInfo = {
  route: '/blog/[slug]',
  file: 'pages/blog/[slug].vue',
  params: ['slug']
}

/** The page the first frame of the current page shows, as the canvas would read it. */
function pageOfFirstFrame(store: ReturnType<typeof openDocument>) {
  const [frame] = store.graph.getChildren(store.state.currentPageId)
  return frame ? readLivePage(frame) : null
}

test('a route filled with a long value still makes a page the schema accepts', () => {
  const store = openDocument()
  const source = useLivePagesSource()

  // A label is cut to what `livePageSchema` holds; left whole, the write succeeds and the next read
  // drops the page, so the frame silently goes back to drawing its own layers.
  const slug = 'x'.repeat(300)
  expect(source.openAll([BLOG_POST], 'http://localhost:3000', { slug })).toBe(1)

  const page = pageOfFirstFrame(store)
  expect(page?.url).toBe(`http://localhost:3000/blog/${slug}`)
  expect(page?.label).toHaveLength(120)
})

test('an address typed without its scheme opens its pages', () => {
  const store = openDocument()
  const source = useLivePagesSource()

  expect(source.openAll([HOME], 'localhost:3000')).toBe(1)

  expect(pageOfFirstFrame(store)?.url).toBe('http://localhost:3000')
})

test('an address that is not of a page opens nothing', () => {
  const store = openDocument()
  const source = useLivePagesSource()

  expect(source.openAll([HOME], 'file:///etc/passwd')).toBe(0)

  expect(store.graph.getChildren(store.state.currentPageId)).toHaveLength(0)
})
