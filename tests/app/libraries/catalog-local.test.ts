import { describe, expect, test } from 'bun:test'

import 'fake-indexeddb/auto'

import type { ComponentLibraryRevision, LibrarySummary } from '@open-pencil/core/library'
import { createLibraryRevision } from '@open-pencil/core/library'
import { SceneGraph } from '@open-pencil/scene-graph'

import { LocalLibraryCatalog } from '@/app/libraries/catalog/local'

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
  publishedAt: string
): Promise<ComponentLibraryRevision> {
  return createLibraryRevision({
    libraryId,
    name: `Library ${libraryId}`,
    graph: libraryGraph(width),
    publishedAt
  })
}

/** The `latest` row a probe's summary carries for a revision it names. */
function summaryOf({ manifest }: ComponentLibraryRevision): LibrarySummary {
  return {
    libraryId: manifest.libraryId,
    name: manifest.name,
    latestRevisionId: manifest.revisionId,
    publishedAt: manifest.publishedAt,
    assetCount: manifest.assets.length
  }
}

describe('local catalog latest ordering', () => {
  test('a stale probe summary does not roll latest back to an older revision', async () => {
    const catalog = isolatedCatalog()
    // A concurrent publish already advanced latest; the probe's summary predates it.
    const newer = await revision('design-system', 120, '2026-01-02T00:00:00.000Z')
    const older = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    await catalog.cacheRevision(newer)
    await catalog.cacheSummaries([summaryOf(older)])

    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: newer.manifest.revisionId }
    ])
  })

  test('a fresh probe summary still advances latest', async () => {
    const catalog = isolatedCatalog()
    const older = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const newer = await revision('design-system', 120, '2026-01-02T00:00:00.000Z')
    await catalog.cacheRevision(older)
    // The summary arrived; its revision body follows through the needs pass.
    await catalog.cacheSummaries([summaryOf(newer)])

    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: newer.manifest.revisionId }
    ])
  })

  test('an older mirrored write does not roll latest back either', async () => {
    const catalog = isolatedCatalog()
    const newer = await revision('design-system', 120, '2026-01-02T00:00:00.000Z')
    const older = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    await catalog.cacheRevision(newer)
    // A stale pull lands its body late; it must not move latest back.
    await catalog.cacheRevision(older)

    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: newer.manifest.revisionId }
    ])
    expect(
      (await catalog.getRevision('design-system', older.manifest.revisionId)).manifest.revisionId
    ).toBe(older.manifest.revisionId)
  })

  test('a publishedAt tie keeps the row already stored', async () => {
    const catalog = isolatedCatalog()
    const stored = await revision('design-system', 80, '2026-01-01T00:00:00.000Z')
    const rival = await revision('design-system', 120, '2026-01-01T00:00:00.000Z')
    expect(rival.manifest.revisionId).not.toBe(stored.manifest.revisionId)
    await catalog.cacheRevision(stored)
    await catalog.cacheSummaries([summaryOf(rival)])

    expect(await catalog.listLibraries()).toMatchObject([
      { latestRevisionId: stored.manifest.revisionId }
    ])
  })
})
