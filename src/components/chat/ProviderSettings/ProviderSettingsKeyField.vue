<script setup lang="ts">
import { useI18n } from '@inkly/vue'

import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/chat/ProviderSettings/ProviderSettingsInput.vue'
import ProviderSettingsLink from '@/components/chat/ProviderSettings/ProviderSettingsLink.vue'

const { label, modelValue, saved, clearTestId, inputTestId, placeholder, keyUrl, keyUrlLabel } =
  defineProps<{
    label: string
    modelValue: string
    saved: boolean
    clearTestId: string
    inputTestId: string
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
</script>

<template>
  <ProviderSettingsField
    :label="label"
    :clear-label="saved ? dialogs.clear : undefined"
    :test-id="clearTestId"
    @clear="emit('clear')"
  >
    <ProviderSettingsInput
      :model-value="modelValue"
      type="password"
      :test-id="inputTestId"
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
