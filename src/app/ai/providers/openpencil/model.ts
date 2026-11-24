import type { CloudServicesClient } from '@open-pencil/cloud/client'

import type { ModelConfig, ModelProviderRuntime } from '@/app/ai/providers/types'

import { noteCloudRequestSettled } from './balance'
import { OPENPENCIL_AI_PROVIDER } from './provider'

type Fetch = NonNullable<ModelProviderRuntime['fetch']>

/**
 * `fetch`, calling `settled` once each response has been read to its end, failed, or been
 * cancelled. The service records a request's charge as its answer ends, so that is when the
 * wallet changes.
 */
export function settlingFetch(fetch: Fetch, settled: () => void): Fetch {
  return async (input, init) => {
    let response: Response
    try {
      response = await fetch(input, init)
    } catch (error) {
      settled()
      throw error
    }
    const body = response.body
    if (!body) {
      settled()
      return response
    }
    const reader = body.getReader()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      settled()
    }
    const watched = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read()
          if (chunk.done) {
            controller.close()
            finish()
          } else {
            controller.enqueue(chunk.value)
          }
        } catch (error) {
          controller.error(error)
          finish()
        }
      },
      async cancel(reason) {
        finish()
        await reader.cancel(reason)
      }
    })
    return new Response(watched, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  }
}

/**
 * A model on Cloud's AI service, paid for by `workspaceId`. The service authorizes with Cloud's
 * token, which the client's fetch adds to every request, so the key is only a placeholder the SDK
 * requires. Each request that finishes has every view of the workspace's credits read them again.
 */
export function cloudModelConfig(
  client: CloudServicesClient,
  modelID: string,
  workspaceId: string
): { config: ModelConfig; runtime: ModelProviderRuntime } {
  return {
    config: {
      providerID: OPENPENCIL_AI_PROVIDER,
      apiKey: 'openpencil-cloud',
      modelID,
      customModelID: '',
      customBaseURL: client.modelBaseURL,
      customAPIType: 'completions'
    },
    runtime: {
      fetch: settlingFetch(client.fetch, () => noteCloudRequestSettled(workspaceId))
    }
  }
}
