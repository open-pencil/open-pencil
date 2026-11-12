<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useEventListener } from '@vueuse/core'
import { MotionConfig } from 'motion-v'
import { ConfigProvider, TooltipProvider } from 'reka-ui'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import { provideEditor } from '@open-pencil/vue'
import { useI18n } from '@open-pencil/vue/i18n'

import { startCloud } from '@/app/cloud/integration'
import { useDocumentCloseProtection } from '@/app/document/close/use'
import { endRecoverySession, startRecoverySession } from '@/app/document/recovery/session'
import { useFollowingEditorStore } from '@/app/editor/active-store'
import { offerCrashReports } from '@/app/reports/crash'
import { useInterfaceDirection } from '@/app/shell/direction'
import { interfaceScalePreference } from '@/app/shell/interface-scale'
import { animationsEnabled } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import { toast } from '@/app/shell/ui'
import { useRestartApprovals } from '@/app/shell/updater/approvals'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater/check'
import { useWebUpdates } from '@/app/shell/updater/web'
import { openSaveTo } from '@/app/storage/save-to/session'
import { kickSyncEngine } from '@/app/storage/sync'
import { prepareForReload } from '@/app/tabs'
import { CloudHosts } from '@/components/cloud/integration'
import UnsavedChangesDialog from '@/components/document/UnsavedChangesDialog.vue'
import DonationPrompt from '@/components/donation/DonationPrompt.vue'
import PublishLibraryDialog from '@/components/libraries/PublishLibraryDialog.vue'
import LibraryUpdateReviewDialog from '@/components/libraries/review/LibraryUpdateReviewDialog.vue'
import ReportDialogHost from '@/components/reports/ReportDialogHost.vue'
import SaveToHost from '@/components/save-to/SaveToHost.vue'
import AISetupDialog from '@/components/settings/ai-setup/AISetupDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import UsageStatsPrompt from '@/components/sharing/UsageStatsPrompt.vue'
import AppShell from '@/components/shell/AppShell.vue'
import AppToaster from '@/components/shell/AppToaster.vue'
import VoiceCallAudio from '@/components/voice-call/VoiceCallAudio.vue'

const { updates, locale } = useI18n()
const router = useRouter()
const dir = useInterfaceDirection()

useHead({
  titleTemplate: (title) => (title ? `${title} — OpenPencil` : 'OpenPencil'),
  htmlAttrs: {
    lang: locale,
    dir,
    'data-interface-scale': interfaceScalePreference,
    'data-motion': computed(() => (animationsEnabled.value ? 'full' : 'off'))
  }
})

provideEditor(useFollowingEditorStore())
useAppTheme()
useDocumentCloseProtection()
useRestartApprovals()
useWebUpdates()
startRecoverySession()
useEventListener(window, 'pagehide', () => {
  void prepareForReload()
  endRecoverySession()
})
// A page restored from the back/forward cache runs on in the session it had.
useEventListener(window, 'pageshow', (event) => {
  if (event.persisted) startRecoverySession()
})

onMounted(() => {
  toast.setupGlobalErrorHandler()
  void offerCrashReports()
  void scheduleStartupUpdateCheck(updates)
  void kickSyncEngine()
  onUnmounted(
    startCloud({
      leaveLinkAddress: () => router.isReady().then(() => router.replace('/')),
      saveTo: (store, serverId) => openSaveTo(store, { profileId: serverId })
    })
  )
})
</script>

<template>
  <MotionConfig :reduced-motion="animationsEnabled ? 'never' : 'always'">
    <ConfigProvider :dir="dir">
      <TooltipProvider :delay-duration="400">
        <AppShell>
          <RouterView />
        </AppShell>
        <SettingsDialog />
        <AISetupDialog />
        <SaveToHost />
        <CloudHosts />
        <UnsavedChangesDialog />
        <PublishLibraryDialog />
        <LibraryUpdateReviewDialog />
        <UsageStatsPrompt />
        <DonationPrompt />
        <ReportDialogHost />
        <AppToaster />
        <VoiceCallAudio />
      </TooltipProvider>
    </ConfigProvider>
  </MotionConfig>
</template>
