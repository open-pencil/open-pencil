import { expect, test } from 'bun:test'

import * as v from 'valibot'

import { SceneGraph } from '@open-pencil/scene-graph'
import { livePageSchema } from '@open-pencil/scene-graph/plugin-data'

import {
  canShowLivePage,
  normalizeLiveURL,
  pageLabel,
  pluginDataWithLivePage,
  readLivePage
} from '@/app/live-pages/schema'

function frameOf(graph: SceneGraph) {
  const page = graph.getPages()[0]
  if (!page) throw new Error('a new document has a page')
  return graph.createNode('FRAME', page.id, { name: 'Pricing', width: 1440, height: 900 })
}

/** An address a document from somebody else could carry, which is the one a page must refuse. */
// eslint-disable-next-line no-script-url -- What the test is about is refusing this address.
const SCRIPT_ADDRESS = 'javascript:alert(1)'

test('a plain frame shows its own layers', () => {
  const frame = frameOf(new SceneGraph())
  expect(readLivePage(frame)).toBeNull()
  expect(canShowLivePage(frame)).toBe(true)
})

test('a frame keeps the page it was linked to', () => {
  const graph = new SceneGraph()
  const frame = frameOf(graph)
  const page = { url: 'http://localhost:3000/pricing', label: 'Pricing', mode: 'live' as const }
  graph.updateNode(frame.id, { pluginData: pluginDataWithLivePage(frame, page) })
  const linked = graph.getNode(frame.id)
  if (!linked) throw new Error('the frame is still in the graph')
  expect(readLivePage(linked)).toEqual(page)
})

test('unlinking leaves the frame without a page and keeps other entries', () => {
  const graph = new SceneGraph()
  const frame = frameOf(graph)
  const other = { pluginId: 'other', key: 'note', value: 'kept' }
  graph.updateNode(frame.id, {
    pluginData: [
      other,
      ...pluginDataWithLivePage(frame, { url: 'http://localhost:3000', mode: 'live' })
    ]
  })
  const linked = graph.getNode(frame.id)
  if (!linked) throw new Error('the frame is still in the graph')
  const unlinked = pluginDataWithLivePage(linked, null)
  expect(readLivePage({ ...linked, pluginData: unlinked })).toBeNull()
  expect(unlinked).toContainEqual(other)
})

test('an entry of the wrong shape reads as no page', () => {
  const frame = frameOf(new SceneGraph())
  const entries = [{ pluginId: 'open-pencil', key: 'livePage', value: '{"url":"x"}' }]
  expect(readLivePage({ ...frame, pluginData: entries })).toBeNull()
  expect(v.safeParse(livePageSchema, { url: '' }).success).toBe(false)
})

test('a frame that names another kind of address shows its own layers', () => {
  // A `.fig` file can carry any string here; the frame must not be the thing that loads it.
  const frame = frameOf(new SceneGraph())
  const entries = [
    {
      pluginId: 'open-pencil',
      key: 'livePage',
      value: `{"url":"${SCRIPT_ADDRESS}","mode":"live"}`
    }
  ]

  expect(readLivePage({ ...frame, pluginData: entries })).toBeNull()
  expect(v.safeParse(livePageSchema, { url: SCRIPT_ADDRESS, mode: 'live' }).success).toBe(false)
  expect(v.safeParse(livePageSchema, { url: 'http://localhost:3000', mode: 'live' }).success).toBe(
    true
  )
})

test('a layer name longer than a page label still keeps the page readable', () => {
  const graph = new SceneGraph()
  const frame = frameOf(graph)
  const label = pageLabel('x'.repeat(200))
  const page = { url: 'http://localhost:3000/pricing', label, mode: 'live' as const }

  expect(label.length).toBe(120)
  graph.updateNode(frame.id, { pluginData: pluginDataWithLivePage(frame, page) })
  const linked = graph.getNode(frame.id)
  if (!linked) throw new Error('the frame is still in the graph')
  expect(readLivePage(linked)).toEqual(page)
})

test('only a frame can show a page', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  if (!page) throw new Error('a new document has a page')
  const rectangle = graph.createNode('RECTANGLE', page.id, { width: 100, height: 100 })
  expect(canShowLivePage(rectangle)).toBe(false)
})

test('a page address gains its scheme and keeps its path', () => {
  expect(normalizeLiveURL('localhost:3000')).toBe('http://localhost:3000')
  expect(normalizeLiveURL('  localhost:3000/pricing  ')).toBe('http://localhost:3000/pricing')
  expect(normalizeLiveURL('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
})

test('an address this app cannot load answers empty', () => {
  expect(normalizeLiveURL('')).toBe('')
  expect(normalizeLiveURL('   ')).toBe('')
  expect(normalizeLiveURL('file:///etc/passwd')).toBe('')
  expect(normalizeLiveURL('data:text/html,hi')).toBe('')
  expect(normalizeLiveURL(SCRIPT_ADDRESS)).toBe('')
  expect(normalizeLiveURL('ftp://localhost/file')).toBe('')
})
