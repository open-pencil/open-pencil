<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import AppCombobox from '@/components/ui/select/AppCombobox.vue'
import { useAIChat } from '@/app/ai/chat/use'
import { modelPickerOptions } from '@/app/ai/models/picker/options'
import { useProviderModelCatalog } from '@/app/ai/models/catalog/use'

const { modelID, providerDef, providerID } = useAIChat()
const { ai, common } = useI18n()
const fallbackModels = computed(() => providerDef.value.models)
const { models } = useProviderModelCatalog(providerID, fallbackModels)

const options = computed(() => modelPickerOptions(models.value, providerDef.value.models, ai.value))
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
