<script setup lang="ts">
import { onMounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor, useI18n } from '@open-pencil/vue'
import AppShell from '@/components/Shell/AppShell.vue'
import AppToast from '@/components/Shell/AppToast.vue'
import PublishLibraryDialog from '@/components/libraries/PublishLibraryDialog.vue'
import LibraryUpdateReviewDialog from '@/components/libraries/review/LibraryUpdateReviewDialog.vue'
import RecoveryDialog from '@/components/recovery/RecoveryDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { useAppTheme } from '@/app/shell/theme'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater'
import { kickSyncEngine } from '@/app/storage/sync'
import { prepareForReload } from '@/app/tabs'

const store = useEditorStore()
const { dialogs, locale } = useI18n()

useHead({
  titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil'),
  htmlAttrs: { lang: locale }
})

provideEditor(store)
useAppTheme()
useEventListener(window, 'pagehide', () => {
  void prepareForReload()
})

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(dialogs)
  void kickSyncEngine()
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <AppShell>
      <RouterView />
    </AppShell>
    <SettingsDialog />
    <RecoveryDialog />
    <PublishLibraryDialog />
    <LibraryUpdateReviewDialog />
    <AppToast />
  </TooltipProvider>
</template>
