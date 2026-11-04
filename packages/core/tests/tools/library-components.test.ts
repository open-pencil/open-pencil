import { describe, expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { registerComponentCatalog } from '@open-pencil/core/tools'
import { getComponents, insertLibraryComponent, listLibraries } from '@open-pencil/core/tools/read'
import { SceneGraph } from '@open-pencil/scene-graph'

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
            sourceNodeId: 'source',
            contentHash: 'hash'
          }
        }
      ]
    },
    async insertComponent() {
      return { id: '0:instance', componentId: '0:component' }
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
    ).toEqual({ id: '0:instance', componentId: '0:component' })
  })
})
