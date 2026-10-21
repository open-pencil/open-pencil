import { computed, ref, watch } from 'vue'

import type { ModelOption } from '@open-pencil/core/constants'

import type { AIModelProfileDraft } from '@/app/ai/models'
import { cloudCatalogModels } from '@/app/ai/providers/openpencil/catalog'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import {
  cloudAIAvailable,
  cloudAIClient,
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

/**
 * The workspaces and models Cloud's AI service offers while a draft uses it. The first workspace
 * whose plan includes AI is chosen unless the draft names another, and the catalog's default model
 * unless the draft's model is in the catalog.
 */
export function useCloudModelSelection(
  draft: AIModelProfileDraft,
  chooseModel: (modelID: string) => void
) {
  const isCloud = computed(() => draft.providerID === OPENPENCIL_AI_PROVIDER)
  const workspaces = ref<CloudAIWorkspace[]>([])
  const models = ref<ModelOption[]>([])
  const state = ref<CloudModelSelectionState>('unavailable')

  watch(
    [isCloud, cloudAIAvailable],
    async ([cloud, available]) => {
      if (!cloud || !available) {
        workspaces.value = []
        state.value = 'unavailable'
        return
      }
      state.value = 'loading'
      const listed = await cloudAIWorkspaces()
      // Signing out or choosing another provider meanwhile owns the state now.
      if (!isCloud.value || !cloudAIAvailable.value) return
      workspaces.value = listed
      if (!listed.some((workspace) => workspace.id === draft.cloudWorkspaceId)) {
        draft.cloudWorkspaceId = listed[0]?.id
      }
      state.value = listed.length ? 'ready' : 'no-workspace'
    },
    { immediate: true }
  )

  const catalogAttempt = ref(0)
  // Each run supersedes the last, so an older answer never replaces a newer one.
  let catalogRequest = 0
  watch(
    () => [isCloud.value ? draft.cloudWorkspaceId : undefined, catalogAttempt.value] as const,
    async ([workspaceId]) => {
      const request = ++catalogRequest
      models.value = []
      if (state.value === 'catalog-failed') state.value = 'ready'
      const client = workspaceId ? cloudAIClient(workspaceId) : null
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
