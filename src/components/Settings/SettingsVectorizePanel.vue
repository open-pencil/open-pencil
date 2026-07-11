<script setup lang="ts">
import VectorizeSection from '@/components/chat/ProviderSettings/VectorizeSection.vue'
import { provideProviderSettings } from '@/components/chat/ProviderSettings/context'

const providerSettings = provideProviderSettings()

defineExpose({
  save: () => providerSettings.saveVectorizeKeys()
})
</script>

<template>
  <div class="flex flex-col gap-2.5" data-test-id="settings-vectorize-panel">
    <VectorizeSection />
  </div>
</template>
