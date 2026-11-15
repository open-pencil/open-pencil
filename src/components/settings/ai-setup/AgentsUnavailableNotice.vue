<script setup lang="ts">
import { useAIMessages } from '@open-pencil/vue/i18n'

import { isTauri } from '@/app/tauri/env'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { DESKTOP_DOWNLOAD_URL } from '@/constants'

/**
 * Why coding agents are missing: the browser cannot start them, and neither can a desktop
 * package that switches off host processes, such as a Snap or Flatpak.
 */
const { sandboxed = isTauri() } = defineProps<{
  /** A desktop install that cannot start agents rather than the browser. */
  sandboxed?: boolean
}>()
const ai = useAIMessages()
</script>

<template>
  <AppAlert
    :heading="sandboxed ? ai.aiSetupAccessAgentsSandboxed : ai.aiSetupAccessAgentsDesktop"
    :data-agents-unavailable="sandboxed ? 'sandboxed' : 'browser'"
  >
    <template #actions>
      <SettingsLink :href="DESKTOP_DOWNLOAD_URL">
        {{ sandboxed ? ai.aiSetupGetDownload : ai.aiSetupGetDesktop }}
      </SettingsLink>
    </template>
  </AppAlert>
</template>
