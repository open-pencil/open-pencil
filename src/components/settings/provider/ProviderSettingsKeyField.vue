<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'

const { label, modelValue, saved, kind, placeholder, keyURL, keyURLLabel, inputId, hint, error } =
  defineProps<{
    label: string
    modelValue: string
    saved: boolean
    kind: 'api' | 'pexels' | 'unsplash'
    placeholder: string
    inputId?: string
    keyURL?: string
    keyURLLabel?: string
    hint?: string
    error?: string
  }>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
  clear: []
  blur: []
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
    :hint="hint"
    :error="error"
    :label-for="inputId"
    :clear-label="saved ? common.clear : undefined"
    :data-test-id="clearDataTestId"
    @clear="emit('clear')"
    @blur="emit('blur')"
  >
    <template #default="{ control }">
      <ProviderSettingsInput
        v-bind="control"
        :model-value="modelValue"
        :aria-label="label"
        type="password"
        :data-test-id="inputDataTestId"
        :placeholder="placeholder"
        @update:model-value="emit('update:modelValue', String($event))"
        @change="emit('change')"
      />
    </template>
    <template #hint>
      <SettingsLink v-if="keyURL && keyURLLabel" :href="keyURL">
        {{ keyURLLabel }}
      </SettingsLink>
    </template>
  </ProviderSettingsField>
</template>
