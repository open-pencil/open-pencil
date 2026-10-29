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
 * its workspaces are loading, could not be checked, or none of them includes AI, one is chosen,
 * or its models could not be listed.
 */
export type CloudModelSelectionState =
  | 'unavailable'
  | 'loading'
  | 'workspaces-failed'
  | 'no-workspace'
  | 'ready'
  | 'catalog-failed'

type WorkspaceListState = Exclude<CloudModelSelectionState, 'ready' | 'catalog-failed'> | 'listed'

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
  // The workspace list and the catalog load separately, so neither's answer hides the other's failure.
  const workspaceState = ref<WorkspaceListState>('unavailable')
  const catalogFailed = ref(false)
  const state = computed<CloudModelSelectionState>(() => {
    if (workspaceState.value !== 'listed') return workspaceState.value
    return catalogFailed.value ? 'catalog-failed' : 'ready'
  })

  const workspaceAttempt = ref(0)
  // Signing out, switching accounts or choosing another provider supersedes a pending list.
  let workspaceRequest = 0
  let listedIdentity: string | null = null
  watch(
    [isCloud, cloud.identity, workspaceAttempt],
    async ([usesCloud, identity]) => {
      const request = ++workspaceRequest
      if (!usesCloud || !identity) {
        workspaces.value = []
        workspaceState.value = 'unavailable'
        return
      }
      // Another account's workspaces never show while this one's load; the draft keeps its choice.
      if (identity !== listedIdentity) workspaces.value = []
      workspaceState.value = 'loading'
      const listed = await cloud.workspaces().catch(() => null)
      if (request !== workspaceRequest) return
      if (!listed) {
        workspaceState.value = 'workspaces-failed'
        return
      }
      workspaces.value = listed
      listedIdentity = identity
      if (!listed.some((workspace) => workspace.id === draft.cloudWorkspaceId)) {
        draft.cloudWorkspaceId = listed[0]?.id
      }
      workspaceState.value = listed.length ? 'listed' : 'no-workspace'
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
      catalogFailed.value = false
      if (!workspaceId || !identity) return
      const client = cloud.client(workspaceId)
      if (!client) return
      const catalog = await client.catalog().catch(() => null)
      if (request !== catalogRequest) return
      if (!catalog) {
        catalogFailed.value = true
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
    /** Lists the workspaces or the models again, whichever failed. */
    retry: () => {
      if (state.value === 'workspaces-failed') workspaceAttempt.value++
      else catalogAttempt.value++
    }
  }
}
