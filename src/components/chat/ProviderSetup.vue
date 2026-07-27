<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import AppPlaceholder from '@/components/ui/AppPlaceholder.vue'

const { dialogs } = useI18n()
</script>

<template>
  <AppPlaceholder data-test-id="provider-setup" :label="dialogs.connectAIProvider">
    <template #icon>
      <icon-lucide-sparkles class="size-5" />
    </template>
    <template #action>
      <button
        type="button"
        data-test-id="provider-setup-open-settings"
        class="w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        @click="openSettingsDialog('ai')"
      >
        {{ dialogs.openProviderSettings }}
      </button>
    </template>
  </AppPlaceholder>
</template>
