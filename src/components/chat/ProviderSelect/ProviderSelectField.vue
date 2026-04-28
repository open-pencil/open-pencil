<script setup lang="ts">
import ProviderSelect from '@/components/chat/ProviderSelect/ProviderSelect.vue'

const { testId = 'provider-selector' } = defineProps<{
  testId?: string
}>()
</script>

<template>
  <ProviderSelect
    :test-id="testId"
    :ui="{
      trigger:
        'w-full justify-between rounded border border-border bg-input px-2.5 py-1.5 text-xs text-surface',
      item: 'rounded px-2 py-1.5 text-[11px]'
    }"
  />
</template>
