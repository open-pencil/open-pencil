import { describe, expect, mock, test } from 'bun:test'

import type { SkiaRenderer } from '#core/canvas/renderer'
import * as RetainedBacking from '#core/canvas/renderer/retained-backing'
import { SceneGraph } from '#core/scene-graph'
import { updateNodePreview } from '#core/scene-graph/preview'

type TestPicture = {
  delete: ReturnType<typeof mock>
}

type TestSubtreePictureCacheEntry = {
  picture: TestPicture
  pageId: string | null
  sceneVersion: number
  subtreeVersion: number
}

type GraphWithSubtreeVersion = SceneGraph & {
  subtreeVersion?: Map<string, number>
}

type CachedSubtreePictureFn = (
  renderer: SkiaRenderer,
  graph: SceneGraph,
  childId: string,
  sceneVersion: number
) => unknown

function getCachedSubtreePicture() {
  const subject = (
    RetainedBacking as typeof RetainedBacking & {
      cachedSubtreePicture?: CachedSubtreePictureFn
    }
  ).cachedSubtreePicture

  expect(typeof subject).toBe('function')
  return typeof subject === 'function' ? subject : null
}

function createPicture(): TestPicture {
  return {
    delete: mock()
  }
}

function createRenderer() {
  const cache = new Map<string, TestSubtreePictureCacheEntry>()
  const clearImpl = Map.prototype.clear.bind(cache)
  const clearSpy = mock(() => clearImpl())
  Object.defineProperty(cache, 'clear', {
    configurable: true,
    value: clearSpy
  })

  const recordedPictures: TestPicture[] = []
  const PictureRecorder = mock(function () {
    const picture = createPicture()
    recordedPictures.push(picture)

    return {
      beginRecording: mock(() => ({})),
      finishRecordingAsPicture: mock(() => picture),
      delete: mock()
    }
  })
  const ckSubset: Pick<SkiaRenderer['ck'], 'LTRBRect' | 'PictureRecorder'> = {
    LTRBRect: mock((left: number, top: number, right: number, bottom: number) => [
      left,
      top,
      right,
      bottom
    ]),
    PictureRecorder
  }

  const renderer: Partial<SkiaRenderer> = {
    ck: ckSubset as SkiaRenderer['ck'],
    dpr: 1,
    zoom: 1,
    pageId: 'page',
    subtreePictureCache: cache as SkiaRenderer['subtreePictureCache'],
    subtreePictureCachePageId: 'page',
    subtreePictureCacheSceneVersion: 1,
    worldViewport: { x: 0, y: 0, w: 100, h: 100 },
    renderNode: mock()
  }

  return {
    clearSpy,
    recordedPictures,
    renderer: renderer as SkiaRenderer & {
      subtreePictureCache: Map<string, TestSubtreePictureCacheEntry>
    }
  }
}

function createGraph(positionPreviewVersion = 0) {
  const nodes = new Map([
    ['A', { id: 'A', type: 'FRAME', width: 100, height: 100, childIds: [], visible: true }],
    ['B', { id: 'B', type: 'FRAME', width: 100, height: 100, childIds: [], visible: true }],
    ['C', { id: 'C', type: 'FRAME', width: 100, height: 100, childIds: [], visible: true }]
  ])

  const graph: Partial<SceneGraph> = {
    rootId: 'root',
    positionPreviewVersion,
    getNode: mock((id: string) => nodes.get(id)),
    getAbsolutePosition: mock(() => ({ x: 0, y: 0 }))
  }

  return Object.assign(graph, {
    subtreeVersion: new Map<string, number>()
  }) as GraphWithSubtreeVersion
}

function setCacheEntry(
  renderer: SkiaRenderer & {
    subtreePictureCache: Map<string, TestSubtreePictureCacheEntry>
  },
  childId: string,
  overrides: Partial<TestSubtreePictureCacheEntry> = {}
) {
  const picture = overrides.picture ?? createPicture()
  const entry: TestSubtreePictureCacheEntry = {
    picture,
    pageId: renderer.pageId,
    sceneVersion: 1,
    subtreeVersion: 0,
    ...overrides
  }
  renderer.subtreePictureCache.set(childId, entry)
  return entry
}

function createIntegrationFixture() {
  const graph = new SceneGraph()
  const page = graph.addPage('P')
  const frameA = graph.createNode('FRAME', page.id, { width: 200, height: 200 })
  const leaf = graph.createNode('RECTANGLE', frameA.id, { width: 50, height: 50 })

  return { frameA, graph, leaf, page }
}

function prepareIntegrationRenderer(pageId: string) {
  const setup = createRenderer()
  setup.renderer.pageId = pageId
  setup.renderer.subtreePictureCachePageId = pageId
  setup.renderer.subtreePictureCacheSceneVersion = 1
  return setup
}

describe('low-level cache boundary (direct map manipulation)', () => {
  // These tests intentionally manipulate the cache map directly to validate cache-layer boundaries.
  test('cachedSubtreePicture hits for the same node when subtreeVersion matches', () => {
    // Given
    const { renderer } = createRenderer()
    const graph = createGraph(99)
    graph.subtreeVersion?.set('A', 5)
    const cached = setCacheEntry(renderer, 'A', {
      subtreeVersion: 5
    })
    renderer.subtreePictureCachePageId = renderer.pageId
    renderer.subtreePictureCacheSceneVersion = 1

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    const picture = cachedSubtreePicture(renderer, graph, 'A', 1)

    // Then
    expect(picture).toBe(cached.picture)
    expect(cached.picture.delete).not.toHaveBeenCalled()
  })

  test('cachedSubtreePicture re-records when subtreeVersion changes', () => {
    // Given
    const { renderer } = createRenderer()
    const graph = createGraph(7)
    graph.subtreeVersion?.set('A', 6)
    const cached = setCacheEntry(renderer, 'A', {
      subtreeVersion: 5
    })

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    cachedSubtreePicture(renderer, graph, 'A', 1)

    // Then
    expect(cached.picture.delete).toHaveBeenCalledTimes(1)
    expect(renderer.subtreePictureCache.get('A')?.subtreeVersion).toBe(6)
  })

  test('cachedSubtreePicture keeps sibling cache entries alive during repeated drag mutations', () => {
    // Given
    const { renderer } = createRenderer()
    const graph = createGraph(1)
    graph.subtreeVersion?.set('A', 1)
    const cachedA = setCacheEntry(renderer, 'A', {
      subtreeVersion: 0
    })
    const cachedB = setCacheEntry(renderer, 'B', {
      subtreeVersion: 0
    })

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    const picture = cachedSubtreePicture(renderer, graph, 'B', 1)

    // Then
    expect(picture).toBe(cachedB.picture)
    expect(cachedB.picture.delete).not.toHaveBeenCalled()
    expect(cachedA.picture.delete).not.toHaveBeenCalled()
  })

  test('cachedSubtreePicture does not bulk-clear the subtree cache while page and sceneVersion stay stable', () => {
    // Given
    const { clearSpy, renderer } = createRenderer()
    const graph = createGraph(0)
    setCacheEntry(renderer, 'A', { subtreeVersion: 0 })
    setCacheEntry(renderer, 'B', { subtreeVersion: 0 })
    setCacheEntry(renderer, 'C', { subtreeVersion: 0 })
    renderer.subtreePictureCachePageId = renderer.pageId
    renderer.subtreePictureCacheSceneVersion = 1

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    for (let version = 1; version <= 10; version++) {
      graph.positionPreviewVersion = version
      graph.subtreeVersion?.set('A', version)
      cachedSubtreePicture(renderer, graph, 'A', 1)
    }

    // Then
    expect(clearSpy).not.toHaveBeenCalled()
    expect(renderer.subtreePictureCache.size).toBe(3)
    expect(renderer.subtreePictureCache.has('B')).toBe(true)
    expect(renderer.subtreePictureCache.has('C')).toBe(true)
  })

  test('cachedSubtreePicture still clears the whole cache when the page changes', () => {
    // Given
    const { renderer } = createRenderer()
    const graph = createGraph(0)
    graph.subtreeVersion?.set('A', 0)
    renderer.pageId = 'newPage'
    renderer.subtreePictureCachePageId = 'oldPage'
    const cachedA = setCacheEntry(renderer, 'A', {
      pageId: 'oldPage',
      subtreeVersion: 0
    })
    const cachedB = setCacheEntry(renderer, 'B', {
      pageId: 'oldPage',
      subtreeVersion: 0
    })

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    cachedSubtreePicture(renderer, graph, 'A', 1)

    // Then
    expect(cachedA.picture.delete).toHaveBeenCalledTimes(1)
    expect(cachedB.picture.delete).toHaveBeenCalledTimes(1)
    expect(renderer.subtreePictureCache.size).toBe(1)
    expect(renderer.subtreePictureCache.get('A')?.subtreeVersion).toBe(0)
  })

  test('cachedSubtreePicture keeps sibling cache entries when sceneVersion changes but subtreeVersion stays stable', () => {
    // Given
    const { renderer } = createRenderer()
    const graph = createGraph(0)
    graph.subtreeVersion?.set('A', 0)
    graph.subtreeVersion?.set('B', 0)
    renderer.subtreePictureCacheSceneVersion = 1
    const cachedA = setCacheEntry(renderer, 'A', {
      sceneVersion: 1,
      subtreeVersion: 0
    })
    const cachedB = setCacheEntry(renderer, 'B', {
      sceneVersion: 1,
      subtreeVersion: 0
    })

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    const pictureA = cachedSubtreePicture(renderer, graph, 'A', 2)
    const pictureB = cachedSubtreePicture(renderer, graph, 'B', 2)

    // Then
    expect(pictureA).toBe(cachedA.picture)
    expect(pictureB).toBe(cachedB.picture)
    expect(cachedA.picture.delete).not.toHaveBeenCalled()
    expect(cachedB.picture.delete).not.toHaveBeenCalled()
    expect(renderer.subtreePictureCache.size).toBe(2)
    expect(renderer.subtreePictureCache.get('A')?.sceneVersion).toBe(2)
    expect(renderer.subtreePictureCache.get('B')?.sceneVersion).toBe(2)
  })
})

describe('integration via updateNodePreview (AC3 full path)', () => {
  test('integration: nested descendant mutation misses page-child entry and keeps unrelated sibling subtree hit', () => {
    // Given
    const { frameA, graph, leaf, page } = createIntegrationFixture()
    const frameB = graph.createNode('FRAME', page.id, { width: 200, height: 200 })
    const { renderer } = prepareIntegrationRenderer(page.id)
    graph.getAbsolutePosition = mock(() => ({ x: 0, y: 0 }))
    const cachedA = setCacheEntry(renderer, frameA.id, {
      subtreeVersion: graph.subtreeVersion.get(frameA.id) ?? 0
    })
    const cachedB = setCacheEntry(renderer, frameB.id, {
      subtreeVersion: graph.subtreeVersion.get(frameB.id) ?? 0
    })

    // When
    updateNodePreview(graph, leaf.id, { x: 10 })

    // Then
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    cachedSubtreePicture(renderer, graph, frameA.id, 1)
    const pictureForB = cachedSubtreePicture(renderer, graph, frameB.id, 1)

    expect(cachedA.picture.delete).toHaveBeenCalledTimes(1)
    expect(pictureForB).toBe(cachedB.picture)
    expect(cachedB.picture.delete).not.toHaveBeenCalled()
  })

  test('integration: reparent preview invalidates both old and new top-level cache entries', () => {
    // Given
    const { frameA, graph, leaf, page } = createIntegrationFixture()
    const frameB = graph.createNode('FRAME', page.id, { width: 200, height: 200 })
    const { renderer } = prepareIntegrationRenderer(page.id)
    graph.getAbsolutePosition = mock(() => ({ x: 0, y: 0 }))
    const cachedA = setCacheEntry(renderer, frameA.id, {
      subtreeVersion: graph.subtreeVersion.get(frameA.id) ?? 0
    })
    const cachedB = setCacheEntry(renderer, frameB.id, {
      subtreeVersion: graph.subtreeVersion.get(frameB.id) ?? 0
    })

    // When
    updateNodePreview(graph, leaf.id, { parentId: frameB.id })

    // Then
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    cachedSubtreePicture(renderer, graph, frameA.id, 1)
    cachedSubtreePicture(renderer, graph, frameB.id, 1)

    expect(cachedA.picture.delete).toHaveBeenCalledTimes(1)
    expect(cachedB.picture.delete).toHaveBeenCalledTimes(1)
  })

  test('integration: repeated updateNodePreview drag does not bulk-clear the subtree cache', () => {
    // Given
    const { frameA, graph, leaf, page } = createIntegrationFixture()
    const { clearSpy, renderer } = prepareIntegrationRenderer(page.id)
    graph.getAbsolutePosition = mock(() => ({ x: 0, y: 0 }))
    setCacheEntry(renderer, frameA.id, {
      subtreeVersion: graph.subtreeVersion.get(frameA.id) ?? 0
    })

    // When
    const cachedSubtreePicture = getCachedSubtreePicture()
    if (!cachedSubtreePicture) return
    for (let i = 1; i <= 10; i++) {
      updateNodePreview(graph, leaf.id, { x: i })
      cachedSubtreePicture(renderer, graph, frameA.id, 1)
    }

    // Then
    expect(clearSpy).not.toHaveBeenCalled()
  })
})
