<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor, useI18n } from '@open-pencil/vue'
import AppPrompts from '@/components/Shell/AppPrompts.vue'
import AppToast from '@/components/Shell/AppToast.vue'
import SettingsDialog from '@/components/Settings/SettingsDialog.vue'
import { isCloudConfigured } from '@/app/cloud/credentials'
import { kickSyncEngine } from '@/app/cloud/sync'
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

// Settings lives top-right everywhere it can: the Home header hosts it, and
// editor screens host it in their cloud top bar. The floating anchor remains
// only for local-only editors (no cloud → no top bar).
const settingsHostedInPage = computed(
  () => route.name === 'home' || (isCloudConfigured.value && !('no-chrome' in route.query))
)

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(dialogs)
  void kickSyncEngine()
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <RouterView />
    <!-- Always-on settings (cloud storage, etc.) — bottom-left, unless the
         editor top bar hosts Settings + sync status -->
    <!-- z below dialog overlays (z-40/50) so modals dim and block it -->
    <div
      v-if="!settingsHostedInPage"
      class="pointer-events-none fixed bottom-3 left-3 z-[35] flex items-end gap-2"
      data-test-id="app-settings-anchor"
    >
      <div class="pointer-events-auto">
        <SettingsDialog />
      </div>
    </div>
    <AppPrompts />
    <AppToast />
  </TooltipProvider>
</template>
