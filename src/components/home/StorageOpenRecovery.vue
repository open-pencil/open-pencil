<script setup lang="ts">
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'
import { useStorageOpenRecovery } from '@/app/tabs/open/recovery'
import { openStorageDocumentInNewTab } from '@/app/tabs'
import AppButton from '@/components/ui/button/AppButton.vue'

const messages = useCloudMessages()
const common = useCommonMessages()
const recovery = useStorageOpenRecovery()
function retry() {
  return recovery.retry(({ document, binding }) => openStorageDocumentInNewTab(document, binding))
}
</script>

<template>
  <div
    v-if="recovery.target.value"
    role="alert"
    class="flex items-center gap-3 border-b border-border bg-panel px-4 py-2 text-xs text-surface"
  >
    <p class="min-w-0 flex-1">
      {{ messages.documentOpenFailed({ name: recovery.target.value.document.name }) }}
    </p>
    <AppButton :disabled="recovery.retrying.value" @click="retry">{{ messages.retry }}</AppButton>
    <AppButton :disabled="recovery.retrying.value" @click="recovery.dismiss">{{
      common.dismiss
    }}</AppButton>
  </div>
</template>
