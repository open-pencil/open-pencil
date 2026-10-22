import { computed, ref, watch, type Ref } from 'vue'

import type { CloudAIClient } from '@open-pencil/cloud/client'
import type { ModelOption } from '@open-pencil/core/constants'

import type { AIModelProfileDraft } from '@/app/ai/models'
import { cloudCatalogModels } from '@/app/ai/providers/openpencil/catalog'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import {
  cloudAIClient,
  cloudAIIdentity,
  cloudAIWorkspaces,
  type CloudAIWorkspace
} from '@/app/cloud/integration'

/**
 * Where a draft for Cloud's AI service stands: the Home server is signed out or has no service,
 * its workspaces are loading, none of them includes AI, one is chosen, or its models could not
 * be listed.
 */
export type CloudModelSelectionState =
  | 'unavailable'
  | 'loading'
  | 'no-workspace'
  | 'ready'
  | 'catalog-failed'

/** The Home server's AI service as the selection reads it. */
export interface CloudModelSource {
  identity: Readonly<Ref<string | null>>
  workspaces: () => Promise<CloudAIWorkspace[]>
  client: (workspaceId: string) => Pick<CloudAIClient, 'catalog'> | null
}

const HOME_CLOUD: CloudModelSource = {
  identity: cloudAIIdentity,
  workspaces: cloudAIWorkspaces,
  client: cloudAIClient
}

/**
 * The workspaces and models Cloud's AI service offers while a draft uses it. The first workspace
 * whose plan includes AI is chosen unless the draft names another, and the catalog's default model
 * unless the draft's model is in the catalog.
 */
export function useCloudModelSelection(
  draft: AIModelProfileDraft,
  chooseModel: (modelID: string) => void,
  cloud: CloudModelSource = HOME_CLOUD
) {
  const isCloud = computed(() => draft.providerID === OPENPENCIL_AI_PROVIDER)
  const workspaces = ref<CloudAIWorkspace[]>([])
  const models = ref<ModelOption[]>([])
  const state = ref<CloudModelSelectionState>('unavailable')

  // Signing out, switching accounts or choosing another provider supersedes a pending list.
  let workspaceRequest = 0
  watch(
    [isCloud, cloud.identity],
    async ([usesCloud, identity]) => {
      const request = ++workspaceRequest
      if (!usesCloud || !identity) {
        workspaces.value = []
        state.value = 'unavailable'
        return
      }
      state.value = 'loading'
      const listed = await cloud.workspaces()
      if (request !== workspaceRequest) return
      workspaces.value = listed
      if (!listed.some((workspace) => workspace.id === draft.cloudWorkspaceId)) {
        draft.cloudWorkspaceId = listed[0]?.id
      }
      state.value = listed.length ? 'ready' : 'no-workspace'
    },
    { immediate: true }
  )

  const catalogAttempt = ref(0)
  // Each run supersedes the last, so an older answer, or one for an earlier sign-in, is dropped.
  let catalogRequest = 0
  watch(
    () =>
      [
        isCloud.value ? draft.cloudWorkspaceId : undefined,
        cloud.identity.value,
        catalogAttempt.value
      ] as const,
    async ([workspaceId, identity]) => {
      const request = ++catalogRequest
      models.value = []
      if (!workspaceId || !identity) return
      if (state.value === 'catalog-failed') state.value = 'ready'
      const client = cloud.client(workspaceId)
      if (!client) return
      const catalog = await client.catalog().catch(() => null)
      if (request !== catalogRequest) return
      if (!catalog) {
        state.value = 'catalog-failed'
        return
      }
      models.value = cloudCatalogModels(catalog)
      if (!models.value.some((model) => model.id === draft.modelID)) {
        chooseModel(catalog.defaultModelID)
      }
    },
    { immediate: true }
  )

  return {
    isCloud,
    workspaces,
    models,
    state,
    /** Lists the models again after a failure. */
    retryCatalog: () => catalogAttempt.value++
  }
}
