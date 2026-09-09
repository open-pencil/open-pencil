<script setup lang="ts">
import { DialogClose } from 'reka-ui'

import { useI18n, useViewportKind } from '@open-pencil/vue'

import { settingsDialogOpen, settingsDialogSection } from '@/app/settings/dialog'
import ChatSettingsSection from '@/components/settings/chat/ChatSettingsSection.vue'
import DiagnosticsSettingsPanel from '@/components/settings/diagnostics/DiagnosticsSettingsPanel.vue'
import GeneralSettingsPanel from '@/components/settings/general/GeneralSettingsPanel.vue'
import MCPConnectionsSection from '@/components/settings/mcp/MCPConnectionsSection.vue'
import MCPSettingsPanel from '@/components/settings/mcp/MCPSettingsPanel.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import StockPhotoKeysSection from '@/components/settings/provider/StockPhotoKeysSection.vue'
import StorageSettingsPanel from '@/components/settings/storage/StorageSettingsPanel.vue'
import UsageSettingsPanel from '@/components/settings/usage/UsageSettingsPanel.vue'
import VectorizeSettingsSection from '@/components/settings/vectorize/VectorizeSettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'
import AppTabsContent from '@/components/ui/tabs/AppTabsContent.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'

const { isMobile } = useViewportKind()
const { settings, common } = useI18n()
function onOpenChange(open: boolean): void {
  settingsDialogOpen.value = open
}
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

    <AppTabsRoot
      v-model="settingsDialogSection"
      :orientation="isMobile ? 'horizontal' : 'vertical'"
    >
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
            <ChatSettingsSection />
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

    <AppDialogFooter>
      <DialogClose as-child>
        <AppButton color="primary" variant="solid" data-test-id="app-settings-done">
          {{ common.done }}
        </AppButton>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
