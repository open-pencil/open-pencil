<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { listProviderModels } from '@/app/ai/chat/provider-models'
import AppComboboxInput from '@/components/ui/AppComboboxInput.vue'
import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/chat/ProviderSettings/ProviderSettingsInput.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
const suggestedModels = ref<Array<{ id: string; name: string }>>([])
const showModelSuggestions = computed(
  () => ctx.providerID === 'openrouter' || ctx.providerID === 'requesty'
)

async function loadModelSuggestions() {
  if (!showModelSuggestions.value || suggestedModels.value.length) return
  suggestedModels.value = await listProviderModels(ctx.providerID)
}
</script>

<template>
  <template v-if="!ctx.isACP">
    <ProviderSettingsField v-if="ctx.providerDef.supportsCustomBaseURL" :label="dialogs.baseURL">
      <ProviderSettingsInput
        v-model="ctx.baseURLInput"
        data-test-id="provider-settings-base-url"
        placeholder="http://localhost:11434/v1"
        @change="ctx.save"
      />
    </ProviderSettingsField>

    <ProviderSettingsField v-if="ctx.providerDef.supportsCustomModel" :label="dialogs.modelID">
      <AppComboboxInput
        v-if="showModelSuggestions"
        v-model="ctx.customModelInput"
        data-test-id="provider-settings-custom-model"
        :options="suggestedModels.map((model) => ({ value: model.id, label: model.name }))"
        placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
        @focusin="loadModelSuggestions"
        @update:model-value="ctx.save"
      />
      <ProviderSettingsInput
        v-else
        v-model="ctx.customModelInput"
        data-test-id="provider-settings-custom-model"
        placeholder="e.g. llama-3.3-70b"
        @change="ctx.save"
      />
    </ProviderSettingsField>
  </template>
</template>
