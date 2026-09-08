<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'
import { IS_TAURI } from '@open-pencil/core/constants'

import { browserCredentialsRemembered, appCredentialServices } from '@/app/settings/credentials/app'
import { setRememberCredentials } from '@/app/settings/credentials/media'
import { settingsDialogOpen, settingsDialogSection } from '@/app/settings/dialog'
import DiagnosticsSettingsPanel from '@/components/settings/diagnostics/DiagnosticsSettingsPanel.vue'
import GeneralSettingsPanel from '@/components/settings/general/GeneralSettingsPanel.vue'
import MCPConnectionsSection from '@/components/settings/mcp/MCPConnectionsSection.vue'
import MCPSettingsPanel from '@/components/settings/mcp/MCPSettingsPanel.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import StockPhotoKeysSection from '@/components/settings/provider/StockPhotoKeysSection.vue'
import UsageSettingsPanel from '@/components/settings/usage/UsageSettingsPanel.vue'
import StorageSettingsPanel from '@/components/settings/storage/StorageSettingsPanel.vue'
import VectorizeSettingsSection from '@/components/settings/vectorize/VectorizeSettingsSection.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'
import AppTabsContent from '@/components/ui/tabs/AppTabsContent.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'

const { credentials, settings, common } = useI18n()
function onOpenChange(open: boolean): void {
  settingsDialogOpen.value = open
}

const rememberCredentials = computed({
  get: () => browserCredentialsRemembered.value,
  set: (remembered: boolean) => {
    void setRememberCredentials(remembered)
  }
})

const credentialBackendLabel = computed(() => {
  void browserCredentialsRemembered.value
  if (appCredentialServices.manager.backend === 'native') return credentials.value.backendNative
  if (appCredentialServices.manager.backend === 'browser') {
    return credentials.value.backendBrowser
  }
  return credentials.value.backendMemory
})
</script>

<template>
  <AppDialogRoot
    :open="settingsDialogOpen"
    size="lg"
    height="tall"
    data-test-id="app-settings-dialog"
    @update:open="onOpenChange"
  >
    <AppDialogHeader
      :heading="settings.title"
      :description="settings.description"
      :close-label="common.close"
    />

    <AppTabsRoot v-model="settingsDialogSection" orientation="vertical">
      <AppTabsList :label="settings.title">
        <AppTabsTrigger value="general" data-test-id="settings-section-general">
          <template #leading><icon-lucide-settings class="size-3.5" /></template>
          {{ settings.general }}
        </AppTabsTrigger>
        <AppTabsTrigger value="ai" data-test-id="settings-section-ai">
          <template #leading><icon-lucide-sparkles class="size-3.5" /></template>
          {{ settings.aiAndAgents }}
        </AppTabsTrigger>
        <AppTabsTrigger value="usage" data-test-id="settings-section-usage">
          <template #leading><icon-lucide-chart-no-axes-combined class="size-3.5" /></template>
          {{ settings.usage }}
        </AppTabsTrigger>
        <AppTabsTrigger value="diagnostics" data-test-id="settings-section-diagnostics">
          <template #leading><icon-lucide-activity class="size-3.5" /></template>
          {{ settings.diagnostics }}
        </AppTabsTrigger>
        <AppTabsTrigger value="mcp" data-test-id="settings-section-mcp">
          <template #leading><icon-lucide-plug class="size-3.5" /></template>
          {{ settings.automation }}
        </AppTabsTrigger>
        <AppTabsTrigger value="media" data-test-id="settings-section-media">
          <template #leading><icon-lucide-image class="size-3.5" /></template>
          {{ settings.media }}
        </AppTabsTrigger>
        <AppTabsTrigger value="storage" data-test-id="settings-section-storage">
          <template #leading><icon-lucide-cloud class="size-3.5" /></template>
          {{ settings.storage }}
        </AppTabsTrigger>
      </AppTabsList>

      <AppTabsContent value="general" as-child>
        <AppDialogBody><GeneralSettingsPanel /></AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="ai" as-child>
        <AppDialogBody>
          <section class="flex h-full flex-col" data-test-id="settings-ai-panel">
            <ModelsPanel />
          </section>
        </AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="usage" as-child>
        <AppDialogBody><UsageSettingsPanel /></AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="diagnostics" as-child>
        <AppDialogBody><DiagnosticsSettingsPanel /></AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="mcp" as-child>
        <AppDialogBody>
          <section class="flex flex-col" data-test-id="settings-mcp-panel">
            <MCPSettingsPanel />
            <MCPConnectionsSection />
          </section>
        </AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="media" as-child>
        <AppDialogBody>
          <section class="flex flex-col gap-2.5" data-test-id="settings-media-panel">
            <h3 class="text-xs font-semibold text-surface">{{ settings.media }}</h3>
            <StockPhotoKeysSection />
            <VectorizeSettingsSection />
          </section>
        </AppDialogBody>
      </AppTabsContent>
      <AppTabsContent value="storage" as-child>
        <AppDialogBody><StorageSettingsPanel /></AppDialogBody>
      </AppTabsContent>
    </AppTabsRoot>

    <AppDialogFooter :ui="{ footer: 'justify-between' }">
      <div class="mr-auto flex items-center gap-2">
        <AppSwitch
          v-if="!IS_TAURI"
          v-model="rememberCredentials"
          :label="credentials.remember"
          data-test-id="settings-remember-credentials"
        />
        <div>
          <p v-if="!IS_TAURI" class="text-[10px] text-surface">
            {{ credentials.remember }}
          </p>
          <p class="text-[10px] text-muted" data-test-id="settings-credential-backend">
            {{ credentials.storage({ backend: credentialBackendLabel }) }}
          </p>
        </div>
      </div>
      <DialogClose as-child>
        <AppButton color="primary" variant="solid" data-test-id="app-settings-done">
          {{ common.done }}
        </AppButton>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
