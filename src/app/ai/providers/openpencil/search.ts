import type { CloudServicesClient } from '@open-pencil/cloud/client'

import type { AIModelConnection } from '@/app/ai/models/types'
import type { WebSearch } from '@/app/ai/tools/web-search'
import { cloudAIClient } from '@/app/cloud/integration'

import { OPENPENCIL_AI_PROVIDER } from './provider'

type SearchClient = (workspaceId: string) => Pick<CloudServicesClient, 'catalog' | 'search'> | null

/**
 * Web search for a chat on Cloud's services, charged to the workspace that pays for its model, when
 * the service's catalog offers it. Other providers have no search.
 */
export async function cloudWebSearch(
  connection: Pick<AIModelConnection, 'providerID' | 'cloudWorkspaceId'>,
  client: SearchClient = cloudAIClient
): Promise<WebSearch | undefined> {
  if (connection.providerID !== OPENPENCIL_AI_PROVIDER) return undefined
  const services = client(connection.cloudWorkspaceId ?? '')
  if (!services) return undefined
  try {
    const catalog = await services.catalog()
    return catalog.search ? (input) => services.search(input) : undefined
  } catch (error) {
    // The chat still works without search; the model is just not offered it.
    console.warn('Could not read the OpenPencil services catalog', error)
    return undefined
  }
}
