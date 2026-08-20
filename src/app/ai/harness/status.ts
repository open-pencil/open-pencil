import { ref } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

import {
  HARNESS_INSTALL_COMMAND,
  queryHarnessCompanion,
  type HarnessCompanionStatus
} from './process'

export const harnessCompanionStatus = ref<HarnessCompanionStatus>(
  IS_TAURI ? { state: 'unavailable', error: 'Not checked' } : { state: 'missing' }
)
export const harnessCompanionChecking = ref(false)

export async function refreshHarnessCompanionStatus(): Promise<void> {
  if (!IS_TAURI) {
    harnessCompanionStatus.value = { state: 'missing' }
    return
  }
  harnessCompanionChecking.value = true
  try {
    harnessCompanionStatus.value = await queryHarnessCompanion()
  } finally {
    harnessCompanionChecking.value = false
  }
}

export { HARNESS_INSTALL_COMMAND }
