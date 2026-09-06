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
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

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

const navigationClass =
  'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-hover hover:text-surface data-[state=active]:bg-hover data-[state=active]:text-surface'
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

    <div class="flex min-h-0 flex-1">
      <nav class="w-40 shrink-0 border-r border-border p-2" :aria-label="settings.title">
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'general' ? 'active' : 'inactive'"
          data-test-id="settings-section-general"
          @click="settingsDialogSection = 'general'"
        >
          <icon-lucide-settings class="size-3.5" />
          {{ settings.general }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'ai' ? 'active' : 'inactive'"
          data-test-id="settings-section-ai"
          @click="settingsDialogSection = 'ai'"
        >
          <icon-lucide-sparkles class="size-3.5" />
          {{ settings.aiAndAgents }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'usage' ? 'active' : 'inactive'"
          data-test-id="settings-section-usage"
          @click="settingsDialogSection = 'usage'"
        >
          <icon-lucide-chart-no-axes-combined class="size-3.5" />
          {{ settings.usage }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'diagnostics' ? 'active' : 'inactive'"
          data-test-id="settings-section-diagnostics"
          @click="settingsDialogSection = 'diagnostics'"
        >
          <icon-lucide-activity class="size-3.5" />
          {{ settings.diagnostics }}
        </button>

        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'mcp' ? 'active' : 'inactive'"
          data-test-id="settings-section-mcp"
          @click="settingsDialogSection = 'mcp'"
        >
          <icon-lucide-plug class="size-3.5" />
          {{ settings.automation }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'media' ? 'active' : 'inactive'"
          data-test-id="settings-section-media"
          @click="settingsDialogSection = 'media'"
        >
          <icon-lucide-image class="size-3.5" />
          {{ settings.media }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'storage' ? 'active' : 'inactive'"
          data-test-id="settings-section-storage"
          @click="settingsDialogSection = 'storage'"
        >
          <icon-lucide-cloud class="size-3.5" />
          {{ settings.storage }}
        </button>
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <GeneralSettingsPanel v-if="settingsDialogSection === 'general'" />

        <section
          v-else-if="settingsDialogSection === 'ai'"
          class="flex h-full flex-col"
          data-test-id="settings-ai-panel"
        >
          <ModelsPanel />
        </section>

        <UsageSettingsPanel v-else-if="settingsDialogSection === 'usage'" />

        <DiagnosticsSettingsPanel v-else-if="settingsDialogSection === 'diagnostics'" />

        <section
          v-else-if="settingsDialogSection === 'mcp'"
          class="flex flex-col"
          data-test-id="settings-mcp-panel"
        >
          <MCPSettingsPanel />
          <MCPConnectionsSection />
        </section>

        <section
          v-else-if="settingsDialogSection === 'media'"
          class="flex flex-col gap-2.5"
          data-test-id="settings-media-panel"
        >
          <h3 class="text-xs font-semibold text-surface">{{ settings.media }}</h3>
          <StockPhotoKeysSection />
          <VectorizeSettingsSection />
        </section>

        <StorageSettingsPanel v-else />
      </div>
    </div>

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
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
          data-test-id="app-settings-done"
        >
          {{ common.done }}
        </button>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
