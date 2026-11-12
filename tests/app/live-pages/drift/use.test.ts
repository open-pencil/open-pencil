import { expect, test } from 'bun:test'

import { ref } from 'vue'

import { SceneGraph } from '@open-pencil/scene-graph'

import { digestOf } from '@/app/live-pages/drift/compare'
import { baselineMoment } from '@/app/live-pages/drift/format'
import type { BaselineTarget, PageCapture } from '@/app/live-pages/drift/run'
import { emptyDriftFile, type DriftFile } from '@/app/live-pages/drift/schema'
import { usePageDrift, type DriftDocument } from '@/app/live-pages/drift/use'
import type { LivePageEntry } from '@/app/live-pages/use'

function entryOf(graph: SceneGraph, name: string, width = 1440, height = 900): LivePageEntry {
  const page = graph.getPages()[0]
  if (!page) throw new Error('a new document has a page')
  const node = graph.createNode('FRAME', page.id, { name, width, height })
  return {
    nodeId: node.id,
    page: { url: 'http://localhost:3000/pricing', label: name, mode: 'live' },
    node,
    at: { x: 0, y: 0 }
  }
}

/** A document whose baselines a test can read back, standing in for the open one. */
function fakeDocument(initial: DriftFile = emptyDriftFile()) {
  let file = initial
  const writes: DriftFile[] = []
  const document: DriftDocument = {
    read: () => file,
    write(next) {
      file = next
      writes.push(next)
    }
  }
  return { document, writes }
}

/** A capture a test can change between calls, so one page can be drawn and then fail. */
function controllableCapture() {
  const state = { text: 'first' as string | null, targets: [] as BaselineTarget[] }
  const capture: PageCapture = async (target) => {
    state.targets.push(target)
    if (state.text === null) return null
    // The picture answers at the size it was asked to draw, as the desktop browser does.
    return {
      bytes: new TextEncoder().encode(state.text),
      width: target.width ?? 1440,
      height: target.height ?? 900
    }
  }
  return { capture, state }
}

test('keeping a baseline stores the fingerprint of the picture and its size', async () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing', 800, 600)
  const { document, writes } = fakeDocument()
  const { capture, state } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  expect(drift.baselineOf(entry.nodeId)).toBeNull()
  expect(await drift.keep(entry.nodeId)).toBe(1)

  const kept = drift.baselineOf(entry.nodeId)
  expect(kept?.nodeId).toBe(entry.nodeId)
  expect(kept?.url).toBe(entry.page.url)
  expect(kept?.width).toBe(800)
  expect(kept?.height).toBe(600)
  expect(kept?.digest).toBe(await digestOf(new TextEncoder().encode('first')))
  expect(writes.length).toBe(1)
  expect(drift.stateOf(entry.nodeId)).toBe('same')
  expect(state.targets).toEqual([
    { nodeId: entry.nodeId, url: entry.page.url, width: 800, height: 600 }
  ])
})

test('one frame keeps its baseline without touching another frame', async () => {
  const graph = new SceneGraph()
  const pricing = entryOf(graph, 'Pricing')
  const home = entryOf(graph, 'Home')
  const { document } = fakeDocument()
  const { capture } = controllableCapture()
  const drift = usePageDrift({ pages: [pricing, home], document, capture })

  expect(await drift.keep(pricing.nodeId)).toBe(1)
  expect(drift.baselineOf(pricing.nodeId)).not.toBeNull()
  expect(drift.baselineOf(home.nodeId)).toBeNull()
})

test('a page that could not be drawn keeps the baseline it had', async () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing')
  const { document, writes } = fakeDocument()
  const { capture, state } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  await drift.keep(entry.nodeId)
  const before = drift.baselineOf(entry.nodeId)
  state.text = null

  expect(await drift.keep(entry.nodeId)).toBe(0)
  expect(drift.baselineOf(entry.nodeId)).toEqual(before)
  expect(writes.length).toBe(1)
  expect(drift.failure.value).toBe('not-drawn')
})

test('comparing answers same while the page has not changed, and changed once it has', async () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing')
  const { document } = fakeDocument()
  const { capture, state } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  await drift.keep(entry.nodeId)
  expect(await drift.compare(entry.nodeId)).toEqual([{ nodeId: entry.nodeId, state: 'same' }])
  expect(drift.failure.value).toBeNull()

  state.text = 'second'
  expect(await drift.compare(entry.nodeId)).toEqual([{ nodeId: entry.nodeId, state: 'changed' }])
  expect(drift.stateOf(entry.nodeId)).toBe('changed')
})

test('a page with no baseline is not compared yet, and is not a failure', async () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing')
  const { document } = fakeDocument()
  const { capture } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  expect(await drift.compare(entry.nodeId)).toEqual([{ nodeId: entry.nodeId, state: 'none' }])
  expect(drift.failure.value).toBeNull()
})

test('a page that has a baseline but could not be drawn reports a picture that never came', async () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing')
  const { document } = fakeDocument()
  const { capture, state } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  await drift.keep(entry.nodeId)
  state.text = null
  expect(await drift.compare(entry.nodeId)).toEqual([{ nodeId: entry.nodeId, state: 'none' }])
  expect(drift.failure.value).toBe('not-drawn')
})

test('a document that refuses the write says so rather than throwing', async () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing')
  const document: DriftDocument = {
    read: () => emptyDriftFile(),
    write() {
      throw new Error('read-only document')
    }
  }
  const { capture } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  expect(await drift.keep(entry.nodeId)).toBe(0)
  expect(drift.failure.value).toBe('not-saved')
})

test('a baseline written elsewhere reaches the panel', () => {
  const graph = new SceneGraph()
  const entry = entryOf(graph, 'Pricing')
  const file = ref<DriftFile>(emptyDriftFile())
  const document: DriftDocument = {
    read: () => file.value,
    write(next) {
      file.value = next
    }
  }
  const { capture } = controllableCapture()
  const drift = usePageDrift({ pages: [entry], document, capture })

  expect(drift.baselineOf(entry.nodeId)).toBeNull()
  file.value = {
    version: 1,
    references: {
      [entry.nodeId]: {
        nodeId: entry.nodeId,
        url: entry.page.url,
        capturedAt: '2026-11-09T12:00:00.000Z',
        width: 1440,
        height: 900,
        digest: 'a'.repeat(64)
      }
    }
  }
  expect(drift.baselineOf(entry.nodeId)?.digest).toBe('a'.repeat(64))
})

test('a baseline reads back as the moment it was taken', () => {
  expect(baselineMoment('2026-11-09T12:00:00.000Z', 'en-GB')).toContain('2026')
  expect(baselineMoment('2026-11-09T12:00:00.000Z', 'ru')).toContain('2026')
  expect(baselineMoment('not a moment', 'en-GB')).toBe('')
})
