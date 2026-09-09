<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

const { ai } = useI18n()
</script>

<template>
  <AppPlaceholder data-test-id="provider-setup" :label="ai.connectProvider">
    <template #icon>
      <icon-lucide-sparkles class="size-5" />
    </template>
    <template #action>
      <AppButton
        color="primary"
        variant="solid"
        class="w-full"
        data-test-id="provider-setup-open-settings"
        @click="openSettingsDialog('ai')"
      >
        {{ ai.openProviderSettings }}
      </AppButton>
    </template>
  </AppPlaceholder>
</template>
