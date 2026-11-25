<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

import { useMessages } from '@open-pencil/vue/i18n'

import { watchCloudAISetup } from '@/app/ai/providers/openpencil/setup'
import { startCloud } from '@/app/cloud/integration'
import { useAutosaveFeedback } from '@/app/document/autosave/feedback'
import { useDocumentCloseProtection } from '@/app/document/close/use'
import { endRecoverySession, startRecoverySession } from '@/app/document/recovery/session'
import { provideEditorStore, useFollowingEditorStore } from '@/app/editor/active-store'
import { offerCrashReports } from '@/app/reports/crash'
import { useAppTheme } from '@/app/shell/theme'
import { toast } from '@/app/shell/ui'
import { useRestartApprovals } from '@/app/shell/updater/approvals'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater/check'
import { useWebUpdates } from '@/app/shell/updater/web'
import { openSaveTo } from '@/app/storage/save-to/session'
import { kickSyncEngine } from '@/app/storage/sync'
import { prepareForReload } from '@/app/tabs'
import CampaignPromptHost from '@/components/campaigns/CampaignPromptHost.vue'
import { CloudHosts } from '@/components/cloud/integration'
import OpenURLDialog from '@/components/document/open-url/OpenURLDialog.vue'
import UnsavedChangesDialog from '@/components/document/UnsavedChangesDialog.vue'
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

/**
 * The editor app around its workspace: the services that run while it is open, such as Cloud
 * sessions, autosave, recovery, updates, and sync, and the dialogs any of its views can open.
 */
const updates = useMessages('updates')
const router = useRouter()

provideEditorStore(useFollowingEditorStore())
useAppTheme()
useDocumentCloseProtection()
useAutosaveFeedback()
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
  // Signing in to a Cloud plan with AI sets the models up, so nobody has to choose one.
  onUnmounted(watchCloudAISetup())
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <SettingsDialog />
  <AISetupDialog />
  <SaveToHost />
  <CloudHosts />
  <UnsavedChangesDialog />
  <OpenURLDialog />
  <PublishLibraryDialog />
  <LibraryUpdateReviewDialog />
  <UsageStatsPrompt />
  <CampaignPromptHost />
  <ReportDialogHost />
  <AppToaster />
  <VoiceCallAudio />
</template>
