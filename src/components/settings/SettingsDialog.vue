<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from '@open-pencil/vue'
import { IS_TAURI } from '@open-pencil/core/constants'

import { useAIChat } from '@/app/ai/chat/use'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { settingsDialogOpen, settingsDialogSection } from '@/app/settings/dialog'
import MCPConnectionsSection from '@/components/settings/mcp/MCPConnectionsSection.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import StockPhotoKeysSection from '@/components/settings/provider/StockPhotoKeysSection.vue'
import StorageSettingsPanel from '@/components/settings/storage/StorageSettingsPanel.vue'
import VectorizeSettingsSection from '@/components/settings/vectorize/VectorizeSettingsSection.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const { browserCredentialsRemembered, setRememberCredentials } = useAIChat()
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
  if (appCredentialServices.manager.backend === 'native')
    return dialogs.value.credentialBackendNative
  if (appCredentialServices.manager.backend === 'browser') {
    return dialogs.value.credentialBackendBrowser
  }
  return dialogs.value.credentialBackendMemory
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
      :heading="dialogs.settings"
      :description="dialogs.settingsDescription"
      :close-label="dialogs.close"
    />

    <div class="flex min-h-0 flex-1">
      <nav class="w-40 shrink-0 border-r border-border p-2" :aria-label="dialogs.settings">
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'ai' ? 'active' : 'inactive'"
          data-test-id="settings-section-ai"
          @click="settingsDialogSection = 'ai'"
        >
          <icon-lucide-sparkles class="size-3.5" />
          {{ dialogs.settingsAIAndAgents }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'mcp' ? 'active' : 'inactive'"
          data-test-id="settings-section-mcp"
          @click="settingsDialogSection = 'mcp'"
        >
          <icon-lucide-plug class="size-3.5" />
          {{ dialogs.mcpConnections }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'media' ? 'active' : 'inactive'"
          data-test-id="settings-section-media"
          @click="settingsDialogSection = 'media'"
        >
          <icon-lucide-image class="size-3.5" />
          {{ dialogs.settingsMedia }}
        </button>
        <button
          type="button"
          :class="navigationClass"
          :data-state="settingsDialogSection === 'storage' ? 'active' : 'inactive'"
          data-test-id="settings-section-storage"
          @click="settingsDialogSection = 'storage'"
        >
          <icon-lucide-cloud class="size-3.5" />
          {{ dialogs.settingsStorage }}
        </button>
      </nav>

      <div class="min-h-0 flex-1 overflow-y-auto p-4">
        <section
          v-if="settingsDialogSection === 'ai'"
          class="flex h-full flex-col"
          data-test-id="settings-ai-panel"
        >
          <ModelsPanel />
        </section>

        <section
          v-else-if="settingsDialogSection === 'mcp'"
          class="flex flex-col"
          data-test-id="settings-mcp-panel"
        >
          <MCPConnectionsSection />
        </section>

        <section
          v-else-if="settingsDialogSection === 'media'"
          class="flex flex-col gap-2.5"
          data-test-id="settings-media-panel"
        >
          <h3 class="text-xs font-semibold text-surface">{{ dialogs.settingsMedia }}</h3>
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
          :label="dialogs.rememberCredentials"
          data-test-id="settings-remember-credentials"
        />
        <div>
          <p v-if="!IS_TAURI" class="text-[10px] text-surface">
            {{ dialogs.rememberCredentials }}
          </p>
          <p class="text-[10px] text-muted" data-test-id="settings-credential-backend">
            {{ dialogs.credentialStorage({ backend: credentialBackendLabel }) }}
          </p>
        </div>
      </div>
      <DialogClose as-child>
        <button
          type="button"
          class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90"
          data-test-id="app-settings-done"
        >
          {{ dialogs.done }}
        </button>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
