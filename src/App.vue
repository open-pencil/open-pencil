<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor, useI18n } from '@open-pencil/vue'
import AppToast from '@/components/Shell/AppToast.vue'
import SettingsDialog from '@/components/Settings/SettingsDialog.vue'
import { cloudActivityMessage } from '@/app/cloud/activity'
import { kickSyncEngine, syncStatusLabel, syncUiState } from '@/app/cloud/sync'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { useAppTheme } from '@/app/shell/theme'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater'

useHead({ titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil') })

const store = useEditorStore()
const route = useRoute()
const { dialogs } = useI18n()
provideEditor(store)
useAppTheme()

// Files home has its own full-screen upload UI — don't also show the chip.
const showActivityChip = computed(
  () => !!cloudActivityMessage.value && route.name !== 'home'
)

/** Subtle local-first sync state (never blocks the canvas). */
const showSyncChip = computed(() => {
  if (route.name === 'home') return false
  if (showActivityChip.value) return false
  return syncUiState.value === 'syncing' || syncUiState.value === 'offline' || syncUiState.value === 'error'
})

const syncChipLabel = computed(() => {
  if (syncUiState.value === 'syncing') return dialogs.value.cloudSyncSyncing
  if (syncUiState.value === 'offline') return dialogs.value.cloudSyncOffline
  if (syncUiState.value === 'error') return syncStatusLabel.value ?? dialogs.value.cloudSyncError
  return syncStatusLabel.value
})

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(dialogs)
  void kickSyncEngine()
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <RouterView />
    <!-- Always-on settings (cloud storage, etc.) — bottom-left on every screen -->
    <div
      class="pointer-events-none fixed bottom-3 left-3 z-[60] flex items-end gap-2"
      data-test-id="app-settings-anchor"
    >
      <div class="pointer-events-auto">
        <SettingsDialog />
      </div>
      <div
        v-if="showActivityChip"
        class="pointer-events-none flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-muted shadow-sm"
        data-test-id="cloud-activity-status"
      >
        <icon-lucide-cloud class="size-3.5 shrink-0 animate-pulse" />
        <span>{{ cloudActivityMessage }}</span>
      </div>
      <div
        v-else-if="showSyncChip"
        class="pointer-events-none flex items-center gap-2 rounded-lg border border-border bg-panel px-2.5 py-1.5 text-xs text-muted shadow-sm"
        data-test-id="cloud-sync-status"
      >
        <icon-lucide-cloud-off
          v-if="syncUiState === 'offline' || syncUiState === 'error'"
          class="size-3.5 shrink-0 opacity-80"
        />
        <icon-lucide-cloud-upload
          v-else
          class="size-3.5 shrink-0 animate-pulse opacity-80"
        />
        <span>{{ syncChipLabel }}</span>
      </div>
    </div>
    <AppToast />
  </TooltipProvider>
</template>
