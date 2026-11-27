import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { registerComponentCatalog } from '@open-pencil/core/tools'
import { SceneGraph } from '@open-pencil/scene-graph'

import { getComponents, insertLibraryComponent, listLibraries } from '#core/tools/read'

function catalog() {
  return {
    async listLibraries() {
      return [
        {
          libraryId: 'preferred',
          name: 'Preferred design system',
          latestRevisionId: 'r1',
          publishedAt: '2026-01-01T00:00:00.000Z',
          assetCount: 1
        }
      ]
    },
    async listComponents() {
      return [
        {
          libraryId: 'preferred',
          libraryName: 'Preferred design system',
          revisionId: 'r1',
          enabled: true,
          priority: 10,
          asset: {
            key: 'button',
            type: 'COMPONENT' as const,
            name: 'Button',
            description: 'Reusable action',
            sourceId: 'source',
            contentHash: 'hash'
          }
        }
      ]
    },
    async insertComponent() {
      return { id: '0:instance', componentId: '0:component', revisionId: 'r1' }
    }
  }
}

describe('library component tools', () => {
  test('lists libraries and ranks enabled library components before local components', async () => {
    const graph = new SceneGraph()
    const page = graph.getPages()[0]
    if (!page) throw new Error('Expected page')
    graph.createNode('COMPONENT', page.id, { name: 'Button local' })
    const figma = new FigmaAPI(graph)
    figma.currentPage = figma.wrapNode(page.id)
    registerComponentCatalog(graph, catalog())

    expect(await listLibraries.execute(figma, {})).toMatchObject({ count: 1 })
    const result = await getComponents.execute(figma, { name: 'button', source: 'all' })
    expect(result).toMatchObject({
      count: 2,
      components: [
        { source: 'library', libraryId: 'preferred', assetKey: 'button' },
        { source: 'document', name: 'Button local' }
      ]
    })
  })

  test('an enabled library with no component rows degrades to a stub without manifest fields', async () => {
    const graph = new SceneGraph()
    // A stub stands for a library the document asked for: enabled but not enumerable yet.
    graph.enabledLibraries.set('preferred', {
      libraryId: 'preferred',
      revisionId: 'r1',
      enabled: true
    })
    const figma = new FigmaAPI(graph)
    registerComponentCatalog(graph, {
      ...catalog(),
      async listComponents() {
        return []
      }
    })

    const result = (await getComponents.execute(figma, { source: 'libraries' })) as {
      count: number
      components: Record<string, unknown>[]
    }
    expect(result).toMatchObject({
      count: 1,
      components: [
        { source: 'library', libraryId: 'preferred', libraryName: 'Preferred design system' }
      ]
    })
    const stub = result.components[0]
    expect(stub).toBeDefined()
    if (!stub) throw new Error('Expected a stub row')
    for (const field of ['assetKey', 'name', 'revisionId', 'enabled', 'priority']) {
      expect(field in stub).toBe(false)
    }
  })

  test('inserts by stable identity through the configured catalog', async () => {
    const graph = new SceneGraph()
    const figma = new FigmaAPI(graph)
    registerComponentCatalog(graph, catalog())
    expect(
      await insertLibraryComponent.execute(figma, {
        library_id: 'preferred',
        asset_key: 'button',
        variant_values: '{"Size":"Large"}'
      })
    ).toEqual({ id: '0:instance', componentId: '0:component', revisionId: 'r1' })
  })
})
