import { ref, watch, type Ref } from 'vue'

import type { AIProviderID, ModelOption } from '@open-pencil/core/constants'

import { listCatalogModels } from './index'

export function useProviderModelCatalog(
  providerID: Readonly<Ref<AIProviderID>>,
  fallback: Readonly<Ref<ModelOption[]>>
) {
  const models = ref<ModelOption[]>(fallback.value)

  watch(
    providerID,
    async (currentProvider) => {
      const requestedProvider = currentProvider
      models.value = fallback.value
      const loaded = await listCatalogModels(requestedProvider)
      if (providerID.value !== requestedProvider) return
      models.value = loaded
    },
    { immediate: true }
  )

  return { models }
}
