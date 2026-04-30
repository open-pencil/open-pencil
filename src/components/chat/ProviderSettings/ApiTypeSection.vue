<script setup lang="ts">
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
</script>

<template>
  <div v-if="!ctx.isACP && ctx.providerID === 'openai-compatible'" class="flex flex-col gap-1">
    <label class="text-[10px] text-muted">API Type</label>
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
          Completions
        </TabsTrigger>
        <TabsTrigger
          value="responses"
          class="flex-1 rounded px-2 py-1 text-[10px] text-muted data-[state=active]:bg-hover data-[state=active]:text-surface"
        >
          Responses
        </TabsTrigger>
      </TabsList>
      <TabsContent value="completions" />
      <TabsContent value="responses" />
    </TabsRoot>
  </div>
</template>
