<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsLink from '@/components/settings/provider/ProviderSettingsLink.vue'

const { label, modelValue, saved, kind, placeholder, keyURL, keyURLLabel, inputId } = defineProps<{
  label: string
  modelValue: string
  saved: boolean
  kind: 'api' | 'pexels' | 'unsplash'
  placeholder: string
  inputId?: string
  keyURL?: string
  keyURLLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
  clear: []
}>()

const { common } = useI18n()

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
    :label-for="inputId"
    :clear-label="saved ? common.clear : undefined"
    :data-test-id="clearDataTestId"
    @clear="emit('clear')"
  >
    <ProviderSettingsInput
      :model-value="modelValue"
      :id="inputId"
      type="password"
      :data-test-id="inputDataTestId"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', String($event))"
      @change="emit('change')"
    />
    <template #hint>
      <ProviderSettingsLink v-if="keyURL && keyURLLabel" :href="keyURL">
        {{ keyURLLabel }}
      </ProviderSettingsLink>
    </template>
  </ProviderSettingsField>
</template>
