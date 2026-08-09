<script setup lang="ts">
import { onMounted } from 'vue'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor, useI18n } from '@open-pencil/vue'
import AppToast from '@/components/Shell/AppToast.vue'
import TabBar from '@/components/TabBar.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { useAppTheme } from '@/app/shell/theme'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater'
import { startStorageSync } from '@/app/storage/sync'
import { useUnsyncedCloseWarning } from '@/app/storage/unsynced-warning'

useHead({ titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil') })

const store = useEditorStore()
const { dialogs } = useI18n()
provideEditor(store)
useAppTheme()

useUnsyncedCloseWarning()

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(dialogs)
  void startStorageSync()
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <!--
      The strip is app chrome, not editor chrome. Home loads the workspace into
      the view BELOW it rather than leaving the editor, so open documents stay
      open and one click away — the same reason Figma keeps its strip visible on
      the files screen.
    -->
    <div class="flex h-screen w-screen flex-col">
      <TabBar />
      <div class="min-h-0 flex-1">
        <RouterView />
      </div>
    </div>
    <SettingsDialog />
    <AppToast />
  </TooltipProvider>
</template>
