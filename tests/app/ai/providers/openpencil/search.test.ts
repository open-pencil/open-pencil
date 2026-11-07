import { describe, expect, test } from 'bun:test'

import type { ServiceCatalog, SearchResponse } from '@open-pencil/cloud/contract'

import { cloudWebSearch } from '@/app/ai/providers/openpencil/search'

const catalog: ServiceCatalog = { models: [], defaultModelID: 'model' }
const response: SearchResponse = {
  results: [
    {
      url: 'https://example.com/grids',
      title: 'Grids',
      publishedAt: null,
      author: null,
      text: 'Columns and gutters.'
    }
  ]
}

/** A Home server whose service has `offered` as its catalog, recording the workspaces asked for. */
function services(offered: ServiceCatalog | Error) {
  const workspaces: string[] = []
  const client = (workspaceId: string) => {
    workspaces.push(workspaceId)
    return {
      catalog: async () => {
        if (offered instanceof Error) throw offered
        return offered
      },
      search: async () => response
    }
  }
  return { client, workspaces }
}

const cloud = { providerID: 'openpencil' as const, cloudWorkspaceId: 'workspace-1' }

describe('Cloud web search', () => {
  test("searches through the chat's workspace when its catalog offers search", async () => {
    const home = services({ ...catalog, search: { creditsPerRequest: 7 } })
    const search = await cloudWebSearch(cloud, home.client)
    expect(await search?.({ query: 'grids' })).toEqual(response)
    expect(home.workspaces).toEqual(['workspace-1'])
  })

  test('offers no search when the catalog has none', async () => {
    expect(await cloudWebSearch(cloud, services(catalog).client)).toBeUndefined()
  })

  test('still offers search when the catalog cannot be read, for the service to answer', async () => {
    const search = await cloudWebSearch(cloud, services(new Error('offline')).client)
    expect(await search?.({ query: 'grids' })).toEqual(response)
  })

  test('offers no search for other providers or without a workspace', async () => {
    const home = services({ ...catalog, search: { creditsPerRequest: 7 } })
    expect(await cloudWebSearch({ providerID: 'openrouter' }, home.client)).toBeUndefined()
    expect(home.workspaces).toEqual([])
    expect(await cloudWebSearch(cloud, () => null)).toBeUndefined()
  })
})
