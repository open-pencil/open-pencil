<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/chat/ProviderSettings/ProviderSettingsInput.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsField :label="dialogs.mcpServer">
    <ProviderSettingsInput
      v-model="ctx.mcpServerURLInput"
      test-id="provider-settings-mcp-server-url"
      :placeholder="dialogs.mcpServerURLPlaceholder"
      @change="ctx.save"
    />
    <ProviderSettingsInput
      v-model="ctx.mcpServerAuthTokenInput"
      type="password"
      test-id="provider-settings-mcp-server-token"
      :placeholder="dialogs.mcpServerAuthTokenPlaceholder"
      @change="ctx.save"
    />
    <template #hint>
      <p class="text-[10px] leading-relaxed text-muted">{{ dialogs.mcpServerHint }}</p>
    </template>
  </ProviderSettingsField>
</template>