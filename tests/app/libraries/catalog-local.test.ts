import { describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'

import type { ComponentLibraryRevision, LibrarySummary } from '@open-pencil/core/library'
import { createLibraryRevision } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'
import { AppDatabaseClosedError } from '@/app/storage/idb'

function isolatedCatalog(): LocalLibraryCatalog {
  return new LocalLibraryCatalog(`library-cache-${crypto.randomUUID()}`)
}

function libraryGraph(width = 80) {
  const graph = new SceneGraph()
  graph.createNode('COMPONENT', graph.getPages()[0].id, {
    name: 'Button',
    componentKey: 'button',
    width
  })
  return graph
}

/** A revision stamped the way a publisher stamps it; `cache*` calls never mint one. */
function revision(
  libraryId: string,
  width: number,
  publishedAt: string,
  previousRevisionId?: string
): Promise<ComponentLibraryRevision> {
  return createLibraryRevision({
    libraryId,
    name: `Library ${libraryId}`,
    graph: libraryGraph(width),
    publishedAt,
    previousRevisionId
  })
}

/** The `latest` row a probe's summary carries for a revision it names. */
function summaryOf({ manifest }: ComponentLibraryRevision): LibrarySummary {
  return {
    libraryId: manifest.libraryId,
    name: manifest.name,
    latestRevisionId: manifest.revisionId,
    previousRevisionId: manifest.previousRevisionId,
    publishedAt: manifest.publishedAt,
    assetCount: manifest.assets.length
  }
}

describe('local catalog latest ordering by revision-chain identity', () => {
  test('a stale probe summary proven an ancestor of the stored head is rejected', async () => {
    const catalog = isolatedCatalog()
    const parent = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const child = await revision(
      'design-system',
      120,
      '2026-01-02T00:00:00.000Z',
      parent.manifest.revisionId
    )
    await catalog.cacheRevision(child)
    // A probe raced a publish and read the world before it: the parent it names is an
    // ancestor of the stored head, so the row must not move.
    const named = await catalog.cacheSummary(summaryOf(parent))

    expect(named).toBe(false)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: child.manifest.revisionId }
    ])
  })

  test('a skewed-clock publish child is accepted: publisher clocks order nothing', async () => {
    const catalog = isolatedCatalog()
    const parent = await revision('design-system', 80, '2026-01-02T00:00:00.000Z')
    // The child was published from a clock behind its parent's — under a `publishedAt`
    // ordering this write was rejected and the mirror wedged on the stale row for good.
    const child = await revision(
      'design-system',
      120,
      '2026-01-01T00:00:00.000Z',
      parent.manifest.revisionId
    )
    await catalog.cacheRevision(parent)
    const named = await catalog.cacheSummary(summaryOf(child))

    expect(named).toBe(true)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: child.manifest.revisionId }
    ])
  })

  test('a probe summary naming the revision already stored reports success without writing', async () => {
    const catalog = isolatedCatalog()
    const head = await revision('design-system', 120, '2026-01-02T00:00:00.000Z')
    await catalog.cacheRevision(head)

    expect(await catalog.cacheSummary(summaryOf(head))).toBe(true)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: head.manifest.revisionId }
    ])
  })

  test('a fresh probe summary still advances latest', async () => {
    const catalog = isolatedCatalog()
    const parent = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const child = await revision(
      'design-system',
      120,
      '2026-01-02T00:00:00.000Z',
      parent.manifest.revisionId
    )
    await catalog.cacheRevision(parent)
    // The summary arrived; its revision body follows through the needs pass.
    const named = await catalog.cacheSummary(summaryOf(child))

    expect(named).toBe(true)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: child.manifest.revisionId }
    ])
  })

  test('an ancestor-proven stale mirrored write is rejected, its body still stored', async () => {
    const catalog = isolatedCatalog()
    const parent = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const child = await revision(
      'design-system',
      120,
      '2026-01-02T00:00:00.000Z',
      parent.manifest.revisionId
    )
    await catalog.cacheRevision(child)
    // A stale pull lands its body late; it must not move latest back, but the body itself
    // is content-addressed and always worth keeping.
    await catalog.cacheRevision(parent)

    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: child.manifest.revisionId }
    ])
    expect(
      (await catalog.getRevision('design-system', parent.manifest.revisionId)).manifest.revisionId
    ).toBe(parent.manifest.revisionId)
  })

  test('a rival revision that cannot be proven an ancestor is accepted, even at a publishedAt tie', async () => {
    const catalog = isolatedCatalog()
    const stored = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const rival = await revision('design-system', 120, '2026-01-01T00:00:00.000Z')
    expect(rival.manifest.revisionId).not.toBe(stored.manifest.revisionId)
    await catalog.cacheRevision(stored)
    // Two unrelated chains share no ancestry: the rival may well be the remote's head,
    // and rejecting it on a clock tie wedged the mirror. Accept-on-doubt is the correct
    // direction — the probe's etag bookkeeping heals a truly stale write.
    const named = await catalog.cacheSummary(summaryOf(rival))

    expect(named).toBe(true)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: rival.manifest.revisionId }
    ])
  })

  test('ancestry that cannot be proven without bodies accepts the write', async () => {
    const catalog = isolatedCatalog()
    const parent = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const child = await revision(
      'design-system',
      120,
      '2026-01-02T00:00:00.000Z',
      parent.manifest.revisionId
    )
    // A row written before summaries carried the chain link — or by a peer still writing
    // them — and both revision bodies still syncing: nothing can prove the parent is an
    // ancestor of the child, so the write is accepted on doubt.
    const linkless = { ...summaryOf(child) }
    delete linkless.previousRevisionId
    expect(await catalog.cacheSummary(linkless)).toBe(true)
    const named = await catalog.cacheSummary(summaryOf(parent))

    expect(named).toBe(true)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: parent.manifest.revisionId }
    ])
  })

  test('the stored summary’s own parent link proves the first step while the head body syncs', async () => {
    const catalog = isolatedCatalog()
    const parent = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const child = await revision(
      'design-system',
      120,
      '2026-01-02T00:00:00.000Z',
      parent.manifest.revisionId
    )
    // The row names the child but the child's body never landed: the chain walk has
    // nothing to read, and only the summary's own `previousRevisionId` can still prove
    // the parent stale.
    expect(await catalog.cacheSummary(summaryOf(child))).toBe(true)
    const named = await catalog.cacheSummary(summaryOf(parent))

    expect(named).toBe(false)
    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: child.manifest.revisionId }
    ])
  })
})

describe('local catalog retirement', () => {
  test('a read through a closed catalog rejects instead of connecting again', async () => {
    const catalog = isolatedCatalog()
    await catalog.cacheRevision(await revision('design-system', 80, '2026-01-01T00:00:00.000Z'))
    await catalog.close()

    await expect(catalog.listLibraries()).rejects.toBeInstanceOf(AppDatabaseClosedError)
    await expect(catalog.getRevision('design-system')).rejects.toBeInstanceOf(
      AppDatabaseClosedError
    )
    // Closing twice joins the same close: the engine and the test seam can both retire it.
    await expect(catalog.close()).resolves.toBeUndefined()
  })
})
