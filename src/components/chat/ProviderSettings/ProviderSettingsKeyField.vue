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
  kind: 'api' | 'pexels' | 'unsplash'
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

const inputDataTestId = computed(() => {
  if (kind === 'pexels') return 'provider-settings-pexels-key'
  if (kind === 'unsplash') return 'provider-settings-unsplash-key'
  return 'provider-settings-api-key'
})

const clearDataTestId = computed(() => {
  if (kind === 'pexels') return 'provider-settings-clear-pexels-key'
  if (kind === 'unsplash') return 'provider-settings-clear-unsplash-key'
  return 'provider-settings-clear-key'
})
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
