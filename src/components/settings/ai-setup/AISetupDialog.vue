<script setup lang="ts">
import { ref } from 'vue'

import {
  aiSetupDialogOpen,
  aiSetupEntry,
  aiSetupOffersTour,
  closeAISetup
} from '@/app/ai/models/settings/onboarding/dialog'
import { openTour } from '@/app/demo/document'
import { openSettingsDialog } from '@/app/settings/dialog'
import { AppDialogRoot } from '@/components/ui/dialog'

import AISetupFlow from './AISetupFlow.vue'

function onOpenChange(open: boolean): void {
  if (!open) closeAISetup()
}

function openAdvancedSettings(): void {
  closeAISetup()
  openSettingsDialog('ai')
}

const tourOpening = ref(false)
const tourFailed = ref(false)

/**
 * The tour opens in a tab of its own; AI stays one click away in Settings. The dialog closes,
 * which marks the welcome done, only once the tour is open: a failure stays in front of the
 * person with a way to try again.
 */
async function takeTour(): Promise<void> {
  if (tourOpening.value) return
  tourOpening.value = true
  tourFailed.value = false
  try {
    await openTour()
    closeAISetup()
  } catch (error) {
    console.error('[Tour] Could not open the tour:', error)
    tourFailed.value = true
  } finally {
    tourOpening.value = false
  }
}
</script>

<template>
  <AppDialogRoot
    :open="aiSetupDialogOpen"
    size="md"
    data-test-id="ai-setup-dialog"
    @update:open="onOpenChange"
  >
    <AISetupFlow
      :entry="aiSetupEntry"
      :offers-tour="aiSetupOffersTour"
      :tour-opening="tourOpening"
      :tour-failed="tourFailed"
      @close="closeAISetup"
      @advanced="openAdvancedSettings"
      @tour="void takeTour()"
    />
  </AppDialogRoot>
</template>
