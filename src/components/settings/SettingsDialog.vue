<script setup lang="ts">
import { tryOnScopeDispose } from '@vueuse/core'
import { AlertDialogCancel, DialogClose } from 'reka-ui'
import { computed } from 'vue'

import { useViewportKind } from '@open-pencil/vue/editor/viewport-kind'
import { useI18n } from '@open-pencil/vue/i18n'

import { CLOUD_INCLUDED } from '@/app/cloud/integration'
import {
  settingsDialogOpen,
  registerSettingsNavigation,
  settingsDialogSection,
  type SettingsSection
} from '@/app/settings/dialog'
import { provideSettingsNavigation } from '@/app/settings/navigation/use'
import { CloudSettingsSection } from '@/components/cloud/integration'
import ChatSettingsSection from '@/components/settings/chat/ChatSettingsSection.vue'
import DiagnosticsSettingsPanel from '@/components/settings/diagnostics/DiagnosticsSettingsPanel.vue'
import FontSettingsPanel from '@/components/settings/fonts/FontSettingsPanel.vue'
import GeneralSettingsPanel from '@/components/settings/general/GeneralSettingsPanel.vue'
import SettingsBreadcrumb from '@/components/settings/layout/SettingsBreadcrumb.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import MCPWorkspacePanel from '@/components/settings/mcp/MCPWorkspacePanel.vue'
import MediaSettingsPanel from '@/components/settings/media/MediaSettingsPanel.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import PrivacySettingsPanel from '@/components/settings/privacy/PrivacySettingsPanel.vue'
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
import { AppTabsContent, AppTabsList, AppTabsRoot, AppTabsTrigger } from '@/components/ui/tabs'

const { isMobile } = useViewportKind()
const { settings, common } = useI18n()
const navigation = provideSettingsNavigation()
tryOnScopeDispose(registerSettingsNavigation(navigation.request))
const { editing, confirming, crumb } = navigation
const sections = computed(
  () =>
    [
      { value: 'general', label: settings.value.general },
      { value: 'toolbar', label: settings.value.toolbar },
      { value: 'ai', label: settings.value.aiAndAgents },
      { value: 'usage', label: settings.value.usage },
      { value: 'diagnostics', label: settings.value.diagnostics },
      { value: 'privacy', label: settings.value.privacy },
      { value: 'mcp', label: settings.value.mcp },
      { value: 'tools', label: settings.value.toolAccess },
      { value: 'fonts', label: settings.value.fonts },
      { value: 'media', label: settings.value.media },
      { value: 'storage', label: settings.value.storage },
      ...(CLOUD_INCLUDED ? [{ value: 'cloud' as const, label: settings.value.cloud }] : [])
    ] satisfies { value: SettingsSection; label: string }[]
)
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
    navigation.request(
      () => {
        settingsDialogOpen.value = false
      },
      { closesWindow: true }
    )
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
    >
      <!-- An open editor turns the title into the path back to where it was opened from. On a
           phone the section picker below already names the section, so the path starts at the
           list. -->
      <template v-if="crumb" #title>
        <SettingsBreadcrumb
          :steps="isMobile ? [crumb.parent] : [settings.title, crumb.parent]"
          :current="crumb.title"
          @back="navigation.back()"
        />
      </template>
    </AppDialogHeader>

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
        <AppTabsTrigger value="general" data-test-id="settings-section-general">
          <template #leading><icon-lucide-settings class="size-3.5" /></template>
          {{ settings.general }}
        </AppTabsTrigger>
        <AppTabsTrigger value="toolbar" data-test-id="settings-section-toolbar">
          <template #leading><icon-lucide-panel-bottom class="size-3.5" /></template>
          {{ settings.toolbar }}
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
        <AppTabsTrigger value="privacy" data-test-id="settings-section-privacy">
          <template #leading><icon-lucide-shield class="size-3.5" /></template>
          {{ settings.privacy }}
        </AppTabsTrigger>
        <AppTabsTrigger value="mcp" data-test-id="settings-section-mcp">
          <template #leading><icon-lucide-plug class="size-3.5" /></template>
          {{ settings.mcp }}
        </AppTabsTrigger>
        <AppTabsTrigger value="tools" data-test-id="settings-section-tools">
          <template #leading><icon-lucide-sliders-horizontal class="size-3.5" /></template>
          {{ settings.toolAccess }}
        </AppTabsTrigger>
        <AppTabsTrigger value="fonts" data-test-id="settings-section-fonts">
          <template #leading><icon-lucide-type class="size-3.5" /></template>
          {{ settings.fonts }}
        </AppTabsTrigger>
        <AppTabsTrigger value="media" data-test-id="settings-section-media">
          <template #leading><icon-lucide-image class="size-3.5" /></template>
          {{ settings.media }}
        </AppTabsTrigger>
        <AppTabsTrigger value="storage" data-test-id="settings-section-storage">
          <template #leading><icon-lucide-database class="size-3.5" /></template>
          {{ settings.storage }}
        </AppTabsTrigger>
        <AppTabsTrigger v-if="CLOUD_INCLUDED" value="cloud" data-test-id="settings-section-cloud">
          <template #leading><icon-lucide-cloud class="size-3.5" /></template>
          {{ settings.cloud }}
        </AppTabsTrigger>
      </AppTabsList>

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
      <AppTabsContent value="fonts" as-child>
        <FontSettingsPanel />
      </AppTabsContent>
      <AppTabsContent value="media" as-child>
        <MediaSettingsPanel />
      </AppTabsContent>
      <AppTabsContent value="storage" as-child>
        <StorageSettingsPanel />
      </AppTabsContent>
      <AppTabsContent v-if="CLOUD_INCLUDED" value="cloud" as-child>
        <CloudSettingsSection />
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
