<script setup lang="ts">
import { computed } from 'vue'

import { useSettingsMessages } from '@open-pencil/vue/i18n'

import type { SettingsSaveResult } from '@/app/settings/save-result'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

const { error, result, partialHeading } = defineProps<{
  partialHeading?: string | null
  error?: string | null
  result?: SettingsSaveResult | null
}>()
const settings = useSettingsMessages()
const tone = computed(() => (result === 'partial' ? 'warning' : 'error'))
const description = computed(() =>
  result === 'partial' ? settings.value.partialSaveWarning : undefined
)
</script>

<template>
  <AppAlert
    v-if="error"
    :tone="tone"
    :heading="result === 'partial' && partialHeading ? partialHeading : settings.saveFailed"
    :description="description"
  />
</template>
