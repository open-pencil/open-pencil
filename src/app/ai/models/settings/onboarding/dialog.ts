import { computed, ref } from 'vue'

import { aiModelSettings } from '@/app/ai/models/store'
import { appPreferences, updateAISetupState } from '@/app/settings/preferences/store'

import { isUnconfiguredModelSettings } from './apply'

/** `welcome` introduces OpenPencil first; `guided` starts at the setup questions. */
export type AISetupEntry = 'welcome' | 'guided'

export const aiSetupDialogOpen = ref(false)
export const aiSetupEntry = ref<AISetupEntry>('guided')
/** The welcome points to the tour, except when it is offered over the tour itself. */
export const aiSetupOffersTour = ref(true)

/** The welcome's "Don't show this again" choice, saved as soon as it is ticked. */
export const hideWelcomeOnLaunch = computed({
  get: () => appPreferences.value.onboarding.aiSetup === 'done',
  set: (hide: boolean) => updateAISetupState(hide ? 'done' : 'pending')
})

export function openAISetup(entry: AISetupEntry = 'guided', offersTour = true): void {
  aiSetupEntry.value = entry
  aiSetupOffersTour.value = offersTour
  aiSetupDialogOpen.value = true
}

/** Closing hides the dialog for this visit only; opting out is a separate, explicit choice. */
export function closeAISetup(): void {
  aiSetupDialogOpen.value = false
}

/**
 * Offers the welcome on each launch until AI is configured or the person opts out;
 * anyone who already configured AI never sees it. Returns whether the welcome opened.
 */
export function offerAIWelcomeOnLaunch({ inTour }: { inTour: boolean }): boolean {
  // The native test binary starts every run with an empty data store.
  if (import.meta.env.MODE === 'native-test') return false
  if (hideWelcomeOnLaunch.value) return false
  // Configured AI skips the welcome without touching the opt-out, which stays the person's choice.
  if (!isUnconfiguredModelSettings(aiModelSettings.value)) return false
  openAISetup('welcome', !inTour)
  return true
}
