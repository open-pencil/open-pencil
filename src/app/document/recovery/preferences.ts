import { computed, shallowRef, type ComputedRef } from 'vue'

import { appPreferences, updateRecoveryEnabled } from '@/app/settings/preferences/store'

const runtimeOverride = shallowRef<boolean | null>(null)

export const recoveryEnabled: ComputedRef<boolean> = computed(
  () => runtimeOverride.value ?? appPreferences.value.recovery.enabled
)

export function setRecoveryEnabled(enabled: boolean): void {
  updateRecoveryEnabled(enabled)
}

export function setRecoveryRuntimeOverride(enabled: boolean | null): void {
  runtimeOverride.value = enabled
}
