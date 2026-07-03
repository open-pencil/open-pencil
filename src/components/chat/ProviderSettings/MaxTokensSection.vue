<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsField from '@/components/chat/ProviderSettings/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/chat/ProviderSettings/ProviderSettingsInput.vue'
import { useProviderSettingsContext } from '@/components/chat/ProviderSettings/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsField v-if="!ctx.isACP" :label="dialogs.maxOutputTokens">
    <ProviderSettingsInput
      v-model.number="ctx.maxOutputTokens"
      type="number"
      data-test-id="provider-settings-max-tokens"
      :min="1024"
      :max="128000"
      :step="1024"
    />
  </ProviderSettingsField>
</template>
