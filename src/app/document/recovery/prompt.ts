import { until } from '@vueuse/core'
import { ref } from 'vue'

/** Whether the launch prompt to recover unsaved work is open. */
export const recoveryPromptOpen = ref(false)
const recoveryPromptChecked = ref(false)

/** The launch check for unsaved work is done, whether or not it found any. */
export function markRecoveryPromptChecked(): void {
  recoveryPromptChecked.value = true
}

/**
 * Resolves once the recovery prompt is out of the way: checked, and closed if it opened. Other
 * launch prompts wait for it, so unsaved work comes first and dialogs never stack.
 */
export async function recoveryPromptSettled(): Promise<void> {
  await until(recoveryPromptChecked).toBe(true)
  await until(recoveryPromptOpen).toBe(false)
}
