<script setup lang="ts">
import { tryOnScopeDispose } from '@vueuse/core'
import { AlertDialogCancel, DialogClose } from 'reka-ui'
import { computed, type Component } from 'vue'
import IconActivity from '~icons/lucide/activity'
import IconChart from '~icons/lucide/chart-no-axes-combined'
import IconCloud from '~icons/lucide/cloud'
import IconImage from '~icons/lucide/image'
import IconPanelBottom from '~icons/lucide/panel-bottom'
import IconPlug from '~icons/lucide/plug'
import IconSettings from '~icons/lucide/settings'
import IconShield from '~icons/lucide/shield'
import IconSliders from '~icons/lucide/sliders-horizontal'
import IconSparkles from '~icons/lucide/sparkles'

import { useI18n, useViewportKind } from '@open-pencil/vue'

import {
  settingsDialogOpen,
  registerSettingsNavigation,
  settingsDialogSection,
  type SettingsSection
} from '@/app/settings/dialog'
import { provideSettingsNavigation } from '@/app/settings/navigation/use'
import ChatSettingsSection from '@/components/settings/chat/ChatSettingsSection.vue'
import DiagnosticsSettingsPanel from '@/components/settings/diagnostics/DiagnosticsSettingsPanel.vue'
import GeneralSettingsPanel from '@/components/settings/general/GeneralSettingsPanel.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import MCPWorkspacePanel from '@/components/settings/mcp/MCPWorkspacePanel.vue'
import MediaSettingsPanel from '@/components/settings/media/MediaSettingsPanel.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import PrivacySettingsPanel from '@/components/settings/privacy/PrivacySettingsPanel.vue'
import ServiceSetupPanel from '@/components/settings/service-setup/ServiceSetupPanel.vue'
import StorageSettingsPanel from '@/components/settings/storage/StorageSettingsPanel.vue'
import ToolAccessSettingsPanel from '@/components/settings/tool-access/ToolAccessSettingsPanel.vue'
import ToolbarSettingsPanel from '@/components/settings/toolbar/ToolbarSettingsPanel.vue'
import UsageSettingsPanel from '@/components/settings/usage/UsageSettingsPanel.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import {
  AppAlertDialogRoot,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppTabsContent from '@/components/ui/tabs/AppTabsContent.vue'
import AppTabsList from '@/components/ui/tabs/AppTabsList.vue'
import AppTabsRoot from '@/components/ui/tabs/AppTabsRoot.vue'
import AppTabsTrigger from '@/components/ui/tabs/AppTabsTrigger.vue'

const { isMobile } = useViewportKind()
const { settings, common } = useI18n()
const navigation = provideSettingsNavigation()
tryOnScopeDispose(registerSettingsNavigation(navigation.request))
const { editing, confirming } = navigation
type SectionItem = { value: SettingsSection; label: string; icon: Component }
// The services System setup lists sit under it; the app's own settings follow.
const setupSections = computed<SectionItem[]>(() => [
  { value: 'ai', label: settings.value.aiAndAgents, icon: IconSparkles },
  { value: 'mcp', label: settings.value.mcp, icon: IconPlug },
  { value: 'tools', label: settings.value.toolAccess, icon: IconSliders },
  { value: 'media', label: settings.value.media, icon: IconImage },
  { value: 'storage', label: settings.value.storage, icon: IconCloud }
])
const appSections = computed<SectionItem[]>(() => [
  { value: 'general', label: settings.value.general, icon: IconSettings },
  { value: 'toolbar', label: settings.value.toolbar, icon: IconPanelBottom },
  { value: 'usage', label: settings.value.usage, icon: IconChart },
  { value: 'diagnostics', label: settings.value.diagnostics, icon: IconActivity },
  { value: 'privacy', label: settings.value.privacy, icon: IconShield }
])
const sections = computed<{ value: SettingsSection; label: string }[]>(() => [
  { value: 'setup', label: settings.value.serviceSetup },
  ...setupSections.value,
  ...appSections.value
])
function onSectionChange(section: string | number): void {
  const match = sections.value.find((item) => item.value === section)
  if (!match || match.value === settingsDialogSection.value) return
  navigation.request(() => {
    settingsDialogSection.value = match.value
  })
}
function onOpenChange(open: boolean): void {
  if (open) settingsDialogOpen.value = true
  else
    navigation.request(() => {
      settingsDialogOpen.value = false
    })
}
</script>

<template>
  <AppDialogRoot
    :open="settingsDialogOpen"
    size="xl"
    :ui="{ content: 'w-[min(52.5rem,96vw)]' }"
    height="full"
    data-test-id="app-settings-dialog"
    @update:open="onOpenChange"
  >
    <AppDialogHeader
      :heading="settings.title"
      :description="settings.description"
      :close-label="common.close"
    />

    <AppTabsRoot
      :model-value="settingsDialogSection"
      @update:model-value="onSectionChange"
      :orientation="isMobile ? 'horizontal' : 'vertical'"
    >
      <div v-if="isMobile" class="shrink-0 border-b border-border p-3">
        <AppSelect
          :model-value="settingsDialogSection"
          :options="sections"
          :label="settings.title"
          :ui="{ trigger: 'w-full' }"
          @update:model-value="onSectionChange"
        />
      </div>
      <AppTabsList v-show="!isMobile" :label="settings.title">
        <AppTabsTrigger value="setup" data-test-id="settings-section-setup">
          <template #leading><icon-lucide-list-checks class="size-3.5" /></template>
          {{ settings.serviceSetup }}
        </AppTabsTrigger>
        <AppTabsTrigger
          v-for="item in setupSections"
          :key="item.value"
          :value="item.value"
          :data-test-id="`settings-section-${item.value}`"
          :ui="{ trigger: 'ps-7' }"
        >
          <template #leading><component :is="item.icon" class="size-3.5" /></template>
          {{ item.label }}
        </AppTabsTrigger>
        <AppTabsTrigger
          v-for="item in appSections"
          :key="item.value"
          :value="item.value"
          :data-test-id="`settings-section-${item.value}`"
        >
          <template #leading><component :is="item.icon" class="size-3.5" /></template>
          {{ item.label }}
        </AppTabsTrigger>
      </AppTabsList>

      <AppTabsContent value="setup" as-child>
        <ServiceSetupPanel />
      </AppTabsContent>
      <AppTabsContent value="general" as-child>
        <SettingsPage><GeneralSettingsPanel /></SettingsPage>
      </AppTabsContent>
      <AppTabsContent value="toolbar" as-child>
        <SettingsPage><ToolbarSettingsPanel /></SettingsPage>
      </AppTabsContent>
      <AppTabsContent value="ai" as-child>
        <section class="flex min-h-0 min-w-0 flex-1 flex-col" data-test-id="settings-ai-panel">
          <ModelsPanel>
            <ChatSettingsSection />
          </ModelsPanel>
        </section>
      </AppTabsContent>
      <AppTabsContent value="usage" as-child>
        <SettingsPage><UsageSettingsPanel /></SettingsPage>
      </AppTabsContent>
      <AppTabsContent value="diagnostics" as-child>
        <SettingsPage><DiagnosticsSettingsPanel /></SettingsPage>
      </AppTabsContent>
      <AppTabsContent value="privacy" as-child>
        <SettingsPage><PrivacySettingsPanel /></SettingsPage>
      </AppTabsContent>
      <AppTabsContent value="mcp" as-child>
        <MCPWorkspacePanel />
      </AppTabsContent>
      <AppTabsContent value="tools" as-child>
        <ToolAccessSettingsPanel />
      </AppTabsContent>
      <AppTabsContent value="media" as-child>
        <MediaSettingsPanel />
      </AppTabsContent>
      <AppTabsContent value="storage" as-child>
        <StorageSettingsPanel />
      </AppTabsContent>
    </AppTabsRoot>

    <AppDialogFooter v-if="!editing">
      <DialogClose as-child>
        <AppButton color="primary" variant="solid" data-test-id="app-settings-done">
          {{ common.done }}
        </AppButton>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
  <AppAlertDialogRoot :open="confirming" @update:open="!$event && navigation.keepEditing()">
    <AppDialogHeader
      :heading="settings.discardChanges"
      :description="settings.discardChangesDescription"
      :show-close="false"
    />
    <AppDialogFooter>
      <AlertDialogCancel as-child
        ><AppButton>{{ settings.keepEditing }}</AppButton></AlertDialogCancel
      >
      <AppButton color="error" variant="solid" @click="navigation.discard">{{
        settings.discard
      }}</AppButton>
    </AppDialogFooter>
  </AppAlertDialogRoot>
</template>
