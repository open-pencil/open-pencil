import type { CloudServicesClient } from '@open-pencil/cloud/client'

import type { AIModelConnection } from '@/app/ai/models/types'
import type { WebSearch } from '@/app/ai/tools/web-search'
import { cloudAIClient } from '@/app/cloud/integration'

import { OPENPENCIL_AI_PROVIDER } from './provider'

type SearchClient = (workspaceId: string) => Pick<CloudServicesClient, 'catalog' | 'search'> | null

/**
 * Web search for a chat on Cloud's services, charged to the workspace that pays for its model, when
 * the service's catalog offers it. A catalog that cannot be read leaves search offered, so a
 * passing failure does not take it away for the rest of the chat; a service without search then
 * answers `capability_unavailable`, which the tool reports. Other providers have no search.
 */
export async function cloudWebSearch(
  connection: Pick<AIModelConnection, 'providerID' | 'cloudWorkspaceId'>,
  client: SearchClient = cloudAIClient
): Promise<WebSearch | undefined> {
  if (connection.providerID !== OPENPENCIL_AI_PROVIDER) return undefined
  const services = client(connection.cloudWorkspaceId ?? '')
  if (!services) return undefined
  const search: WebSearch = (input) => services.search(input)
  try {
    return (await services.catalog()).search ? search : undefined
  } catch (error) {
    console.warn('Could not read the OpenPencil services catalog', error)
    return search
  }
}
