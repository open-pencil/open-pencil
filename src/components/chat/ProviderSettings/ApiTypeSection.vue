<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { useI18n } from '@inkly/vue'

import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsField
    v-if="!ctx.isACP && ctx.providerID === 'openai-compatible'"
    :label="dialogs.apiType"
  >
    <TabsRoot
      :model-value="ctx.customAPIType"
      data-test-id="provider-settings-api-type"
      class="flex flex-col"
      @update:model-value="ctx.setCustomAPIType"
    >
      <TabsList class="flex rounded bg-canvas">
        <TabsTrigger
          value="completions"
          class="flex-1 rounded px-2 py-1 text-[10px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
        >
          {{ dialogs.completions }}
        </TabsTrigger>
        <TabsTrigger
          value="responses"
          class="flex-1 rounded px-2 py-1 text-[10px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
        >
          {{ dialogs.responses }}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="completions" />
      <TabsContent value="responses" />
    </TabsRoot>
  </ProviderSettingsField>
</template>
