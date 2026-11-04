import { ref } from 'vue'

import { aiModelSettings } from '@/app/ai/models/store'
import { appPreferences, updateAISetupState } from '@/app/settings/preferences/store'

import { isUnconfiguredModelSettings } from './apply'

/** `welcome` introduces OpenPencil first; `guided` starts at the setup questions. */
export type AISetupEntry = 'welcome' | 'guided'

export const aiSetupDialogOpen = ref(false)
export const aiSetupEntry = ref<AISetupEntry>('guided')
/** The welcome points to the tour, except when it is offered over the tour itself. */
export const aiSetupOffersTour = ref(true)

export function openAISetup(entry: AISetupEntry = 'guided', offersTour = true): void {
  aiSetupEntry.value = entry
  aiSetupOffersTour.value = offersTour
  aiSetupDialogOpen.value = true
}

/** Closing guided setup in any way counts as done, so the welcome is offered only once. */
export function closeAISetup(): void {
  aiSetupDialogOpen.value = false
  updateAISetupState('done')
}

/**
 * Offers the welcome to a fresh install; anyone who already configured AI never sees it.
 * Returns whether the welcome opened.
 */
export function offerAISetupOnFirstRun({ inTour }: { inTour: boolean }): boolean {
  // The native test binary starts every run with an empty data store.
  if (import.meta.env.MODE === 'native-test') return false
  if (appPreferences.value.onboarding.aiSetup === 'done') return false
  if (!isUnconfiguredModelSettings(aiModelSettings.value)) {
    updateAISetupState('done')
    return false
  }
  openAISetup('welcome', !inTour)
  return true
}
