import { useLocalStorage } from '@vueuse/core'
import { watch } from 'vue'

import { setFigPopulationWorkersEnabled } from '@open-pencil/core/kiwi'

export const figPopulationWorkersEnabled = useLocalStorage(
  'op-fig-population-workers-enabled',
  true
)

watch(figPopulationWorkersEnabled, (enabled) => setFigPopulationWorkersEnabled(enabled), {
  immediate: true
})
