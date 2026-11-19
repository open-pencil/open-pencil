import * as v from 'valibot'

import type { CloudServicesClient } from '@open-pencil/cloud/client'
import { serviceErrorCodeSchema, type ServiceErrorCode } from '@open-pencil/cloud/contract'
import { WebSearchRefusedError, type WebSearchProvider } from '@open-pencil/core/tools'

import type { AIModelConnection } from '@/app/ai/models/types'
import { cloudAIClient } from '@/app/cloud/integration'

import { OPENPENCIL_AI_PROVIDER } from './provider'

type SearchClient = (workspaceId: string) => Pick<CloudServicesClient, 'catalog' | 'search'> | null

/** What the model is told when the service refuses a search, so it can tell the person. */
const REFUSALS: Partial<Record<ServiceErrorCode, string>> = {
  insufficient_credits:
    'The workspace is out of OpenPencil credits, so searches fail until they renew or more are added.',
  rate_limited: 'Too many requests at once. Try again shortly.',
  capability_unavailable: "This Cloud's services do not offer web search."
}

// Read by shape: the build without Cloud bundles none of the client, `CloudServiceError` included.
const serviceErrorSchema = v.object({
  name: v.literal('CloudServiceError'),
  code: serviceErrorCodeSchema
})

/**
 * Web search on Cloud's services, charged to the workspace that pays for the Design model, when
 * the service's catalog offers it. A catalog that cannot be read leaves search offered, so a
 * passing failure does not take it away; a service without search then answers
 * `capability_unavailable`, which the model is told. Other providers have no Cloud search.
 */
export async function cloudWebSearch(
  connection: Pick<AIModelConnection, 'providerID' | 'cloudWorkspaceId'>,
  client: SearchClient = cloudAIClient
): Promise<WebSearchProvider | null> {
  if (connection.providerID !== OPENPENCIL_AI_PROVIDER) return null
  const services = client(connection.cloudWorkspaceId ?? '')
  if (!services) return null
  const provider: WebSearchProvider = {
    async search(request) {
      try {
        return await services.search(request)
      } catch (error) {
        const refused = v.safeParse(serviceErrorSchema, error)
        const refusal = refused.success ? REFUSALS[refused.output.code] : undefined
        throw refusal ? new WebSearchRefusedError(refusal) : error
      }
    }
  }
  try {
    return (await services.catalog()).search ? provider : null
  } catch (error) {
    console.warn('Could not read the OpenPencil services catalog', error)
    return provider
  }
}
