import { describe, expect, test } from 'bun:test'

import { CloudServiceError } from '@open-pencil/cloud/client'
import type { ServiceCatalog, SearchResponse } from '@open-pencil/cloud/contract'
import { WebSearchRefusedError } from '@open-pencil/core/tools'

import { cloudWebSearch } from '@/app/ai/providers/openpencil/search'

const catalog: ServiceCatalog = { models: [], defaultModelID: 'model' }
const offered: ServiceCatalog = { ...catalog, search: { creditsPerRequest: 7 } }
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
const request = { query: 'grids', numResults: 5 }

/** A Home server whose service lists `listed` and answers searches with `answer`. */
function services(
  listed: ServiceCatalog | Error,
  answer: () => Promise<SearchResponse> = async () => response
) {
  const workspaces: string[] = []
  const client = (workspaceId: string) => {
    workspaces.push(workspaceId)
    return {
      catalog: async () => {
        if (listed instanceof Error) throw listed
        return listed
      },
      search: answer
    }
  }
  return { client, workspaces }
}

const cloud = { providerID: 'openpencil' as const, cloudWorkspaceId: 'workspace-1' }

describe('Cloud web search', () => {
  test("searches through the Design model's workspace when its catalog offers search", async () => {
    const home = services(offered)
    const provider = await cloudWebSearch(cloud, home.client)
    expect(await provider?.search(request)).toEqual(response)
    expect(home.workspaces).toEqual(['workspace-1'])
  })

  test('has no search when the catalog lists none', async () => {
    expect(await cloudWebSearch(cloud, services(catalog).client)).toBeNull()
  })

  test('keeps search when the catalog cannot be read, for the service to answer', async () => {
    const provider = await cloudWebSearch(cloud, services(new Error('offline')).client)
    expect(await provider?.search(request)).toEqual(response)
  })

  test('turns refusals the person can act on into messages for the model', async () => {
    const provider = await cloudWebSearch(
      cloud,
      services(offered, async () => {
        throw new CloudServiceError(402, 'insufficient_credits')
      }).client
    )
    const refusal = await provider?.search(request).catch((error: unknown) => error)
    expect(refusal).toBeInstanceOf(WebSearchRefusedError)
    expect(refusal).toMatchObject({ message: expect.stringContaining('out of OpenPencil credits') })
  })

  test('has no Cloud search for other providers or without a workspace', async () => {
    const home = services(offered)
    expect(await cloudWebSearch({ providerID: 'openrouter' }, home.client)).toBeNull()
    expect(home.workspaces).toEqual([])
    expect(await cloudWebSearch(cloud, () => null)).toBeNull()
  })
})
