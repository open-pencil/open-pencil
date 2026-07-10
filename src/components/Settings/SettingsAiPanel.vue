<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ApiKeySection from '@/components/chat/ProviderSettings/ApiKeySection.vue'
import ApiTypeSection from '@/components/chat/ProviderSettings/ApiTypeSection.vue'
import CustomEndpointSection from '@/components/chat/ProviderSettings/CustomEndpointSection.vue'
import MaxTokensSection from '@/components/chat/ProviderSettings/MaxTokensSection.vue'
import ProviderSelectField from '@/components/chat/ProviderSelect/ProviderSelectField.vue'
import StockPhotoKeysSection from '@/components/chat/ProviderSettings/StockPhotoKeysSection.vue'
import TestConnectionSection from '@/components/chat/ProviderSettings/TestConnectionSection.vue'
import { provideProviderSettings } from '@/components/chat/ProviderSettings/context'

const { dialogs } = useI18n()
const providerSettings = provideProviderSettings()

defineExpose({
  save: () => providerSettings.save()
})
</script>

<template>
  <div class="flex flex-col gap-2.5" data-test-id="settings-ai-panel">
    <h4 class="text-[11px] font-semibold text-surface">{{ dialogs.aiProvider }}</h4>
    <ProviderSelectField data-test-id="settings-ai-provider" />
    <MaxTokensSection />
    <CustomEndpointSection />
    <ApiTypeSection />
    <ApiKeySection />
    <TestConnectionSection />
    <div class="border-t border-border pt-2">
      <h4 class="mb-2 text-[11px] font-semibold text-surface">{{ dialogs.stockPhotos }}</h4>
      <StockPhotoKeysSection />
    </div>
  </div>
</template>
