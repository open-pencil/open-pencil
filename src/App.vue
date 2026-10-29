<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { TooltipProvider } from 'reka-ui'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import { provideEditor } from '@open-pencil/vue'
import { useI18n } from '@open-pencil/vue/i18n'

import { startCloud } from '@/app/cloud/integration'
import { useDocumentCloseProtection } from '@/app/document/close/use'
import { useFollowingEditorStore } from '@/app/editor/active-store'
import { animationsEnabled } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import { toast } from '@/app/shell/ui'
import { useRestartApprovals } from '@/app/shell/updater/approvals'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater/check'
import { kickSyncEngine } from '@/app/storage/sync'
import { prepareForReload } from '@/app/tabs'
import { CloudHosts } from '@/components/cloud/integration'
import UnsavedChangesDialog from '@/components/document/UnsavedChangesDialog.vue'
import PublishLibraryDialog from '@/components/libraries/PublishLibraryDialog.vue'
import LibraryUpdateReviewDialog from '@/components/libraries/review/LibraryUpdateReviewDialog.vue'
import RecoveryDialog from '@/components/recovery/RecoveryDialog.vue'
import SaveToHost from '@/components/save-to/SaveToHost.vue'
import AISetupDialog from '@/components/settings/ai-setup/AISetupDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import UsageStatsPrompt from '@/components/sharing/UsageStatsPrompt.vue'
import AppShell from '@/components/shell/AppShell.vue'
import Toaster from '@/components/shell/Toaster.vue'
import VoiceCallAudio from '@/components/voice-call/VoiceCallAudio.vue'

const { updates, locale } = useI18n()
const router = useRouter()

useHead({
  titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil'),
  htmlAttrs: {
    lang: locale,
    'data-motion': computed(() => (animationsEnabled.value ? 'full' : 'off'))
  }
})

provideEditor(useFollowingEditorStore())
useAppTheme()
useDocumentCloseProtection()
useRestartApprovals()
useEventListener(window, 'pagehide', () => {
  void prepareForReload()
})

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(updates)
  void kickSyncEngine()
  onUnmounted(
    startCloud({ leaveLinkAddress: () => router.isReady().then(() => router.replace('/')) })
  )
})
</script>

<template>
  <MotionConfig :reduced-motion="animationsEnabled ? 'never' : 'always'">
    <TooltipProvider :delay-duration="400">
      <AppShell>
        <RouterView />
      </AppShell>
      <SettingsDialog />
      <AISetupDialog />
      <SaveToHost />
      <CloudHosts />
      <RecoveryDialog />
      <UnsavedChangesDialog />
      <PublishLibraryDialog />
      <LibraryUpdateReviewDialog />
      <UsageStatsPrompt />
      <Toaster />
      <VoiceCallAudio />
    </TooltipProvider>
  </MotionConfig>
</template>
