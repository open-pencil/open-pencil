<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { TooltipProvider } from 'reka-ui'
import { computed, onMounted } from 'vue'

import { provideEditor, useI18n } from '@open-pencil/vue'

import { useDocumentCloseProtection } from '@/app/document/close/use'
import { useEditorStore } from '@/app/editor/active-store'
import { animationsEnabled } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import { toast } from '@/app/shell/ui'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater'
import { kickSyncEngine } from '@/app/storage/sync'
import { prepareForReload } from '@/app/tabs'
import UnsavedChangesDialog from '@/components/document/UnsavedChangesDialog.vue'
import PublishLibraryDialog from '@/components/libraries/PublishLibraryDialog.vue'
import LibraryUpdateReviewDialog from '@/components/libraries/review/LibraryUpdateReviewDialog.vue'
import RecoveryDialog from '@/components/recovery/RecoveryDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import AppShell from '@/components/shell/AppShell.vue'
import Toaster from '@/components/shell/Toaster.vue'

const store = useEditorStore()
const { updates, locale } = useI18n()

useHead({
  titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil'),
  htmlAttrs: {
    lang: locale,
    'data-motion': computed(() => (animationsEnabled.value ? 'full' : 'off'))
  }
})

provideEditor(store)
useAppTheme()
useDocumentCloseProtection()
useEventListener(window, 'pagehide', () => {
  void prepareForReload()
})

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(updates)
  void kickSyncEngine()
})
</script>

<template>
  <MotionConfig :reduced-motion="animationsEnabled ? 'never' : 'always'">
    <TooltipProvider :delay-duration="400">
      <AppShell>
        <RouterView />
      </AppShell>
      <SettingsDialog />
      <RecoveryDialog />
      <UnsavedChangesDialog />
      <PublishLibraryDialog />
      <LibraryUpdateReviewDialog />
      <Toaster />
    </TooltipProvider>
  </MotionConfig>
</template>
