<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/chat/ProviderSettings/ProviderSettingsInput.vue'
import ProviderSettingsLink from '@/components/chat/ProviderSettings/ProviderSettingsLink.vue'

const { label, modelValue, saved, kind, placeholder, keyUrl, keyUrlLabel } = defineProps<{
  label: string
  modelValue: string
  saved: boolean
  kind: 'api' | 'pexels' | 'unsplash' | 'recraft' | 'fal'
  placeholder: string
  keyUrl?: string
  keyUrlLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
  clear: []
}>()

const { dialogs } = useI18n()

const inputDataTestId = computed(() =>
  kind === 'api' ? 'provider-settings-api-key' : `provider-settings-${kind}-key`
)

const clearDataTestId = computed(() =>
  kind === 'api' ? 'provider-settings-clear-key' : `provider-settings-clear-${kind}-key`
)
</script>

<template>
  <ProviderSettingsField
    :label="label"
    :clear-label="saved ? dialogs.clear : undefined"
    :data-test-id="clearDataTestId"
    @clear="emit('clear')"
  >
    <ProviderSettingsInput
      :model-value="modelValue"
      type="password"
      :data-test-id="inputDataTestId"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', String($event))"
      @change="emit('change')"
    />
    <template #hint>
      <ProviderSettingsLink v-if="keyUrl && keyUrlLabel" :href="keyUrl">
        {{ keyUrlLabel }}
      </ProviderSettingsLink>
    </template>
  </ProviderSettingsField>
</template>
