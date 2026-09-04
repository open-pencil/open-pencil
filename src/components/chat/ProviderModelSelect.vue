<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppCombobox from '@/components/ui/AppCombobox.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { useProviderModelCatalog } from '@/app/ai/models/use-provider-model-catalog'

const { modelID, providerDef, providerID } = useAIChat()
const { ai, common } = useI18n()
const fallbackModels = computed(() => providerDef.value.models)
const { models } = useProviderModelCatalog(providerID, fallbackModels)

function modelGroup(modelID: string, recommendedIds: Set<string>, latestIds: Set<string>): string {
  if (recommendedIds.has(modelID)) return ai.value.recommendedModels
  if (latestIds.has(modelID)) return ai.value.latestModels
  return ai.value.allModels
}

const options = computed(() => {
  const recommendedIds = new Set(providerDef.value.models.map((model) => model.id))
  const latestIds = new Set(
    models.value
      .filter((model) => !recommendedIds.has(model.id) && model.releaseDate)
      .slice(0, 8)
      .map((model) => model.id)
  )
  return models.value.map((model) => ({
    value: model.id,
    label: model.name,
    description: model.id,
    meta: model.tag ?? (latestIds.has(model.id) ? ai.value.latest : undefined),
    group: modelGroup(model.id, recommendedIds, latestIds)
  }))
})
</script>

<template>
  <AppCombobox
    v-model="modelID"
    :options="options"
    :label="ai.modelID"
    :search-placeholder="ai.searchModels"
    :empty-label="common.noResults"
    data-test-id="chat-model-selector"
    :ui="{
      trigger: 'h-6 w-auto max-w-72 border-none bg-transparent hover:bg-hover',
      value: 'text-[10px] text-muted',
      content: 'min-w-72'
    }"
  >
    <template #value="{ option }">
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <icon-lucide-bot class="size-3 shrink-0" />
        <slot name="value">
          <span class="truncate">{{ option?.label }}</span>
        </slot>
      </div>
    </template>
  </AppCombobox>
</template>
