<script setup lang="ts">
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

/** The tour opens in a tab of its own; AI stays one click away in Settings. */
function takeTour(): void {
  closeAISetup()
  openTour().catch((error: unknown) => {
    console.error('[Tour] Could not open the tour:', error)
  })
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
      @close="closeAISetup"
      @advanced="openAdvancedSettings"
      @tour="takeTour"
    />
  </AppDialogRoot>
</template>
