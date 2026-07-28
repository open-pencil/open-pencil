import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import { VECTORIZE_PROVIDER_IDS, type VectorizeProviderID } from '@/app/editor/vectorize/types'

const storedProvider = useLocalStorage<string>('open-pencil:vectorize:provider', 'recraft')

function isVectorizeProviderID(value: string): value is VectorizeProviderID {
  return VECTORIZE_PROVIDER_IDS.some((providerID) => providerID === value)
}

export const vectorizeProviderID = computed<VectorizeProviderID>({
  get: () => (isVectorizeProviderID(storedProvider.value) ? storedProvider.value : 'recraft'),
  set: (providerID) => {
    storedProvider.value = providerID
  }
})
