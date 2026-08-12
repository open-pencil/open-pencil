<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor, useI18n } from '@open-pencil/vue'
import AppShell from '@/components/Shell/AppShell.vue'
import AppToast from '@/components/Shell/AppToast.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { useAppTheme } from '@/app/shell/theme'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater'
import { kickSyncEngine } from '@/app/storage/sync'

const store = useEditorStore()
const { dialogs, locale } = useI18n()

useHead({
  titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil'),
  htmlAttrs: { lang: locale }
})

provideEditor(store)
useAppTheme()

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
    <AppToast />
  </TooltipProvider>
</template>
