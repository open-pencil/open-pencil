<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { useI18n } from '@open-pencil/vue'

import statusTheme from '@/theme/status'

import type { ProviderConnectionTestFailureReason } from '@/app/ai/chat/connection-test'

interface ProviderConnectionTestButtonProps {
  status: 'idle' | 'testing' | 'success' | 'error'
  reason?: ProviderConnectionTestFailureReason | null
  disabled?: boolean
}

const { status, reason, disabled = false } = defineProps<ProviderConnectionTestButtonProps>()
const emit = defineEmits<{ test: [] }>()
const { dialogs } = useI18n()

const resultMessage = computed(() => {
  if (status === 'success') return dialogs.value.connectionTestSuccess
  if (status !== 'error') return null

  switch (reason) {
    case 'missing-api-key':
      return dialogs.value.connectionTestMissingAPIKey
    case 'missing-base-url':
      return dialogs.value.connectionTestMissingBaseURL
    case 'missing-model':
      return dialogs.value.connectionTestMissingModel
    case 'invalid-base-url':
      return dialogs.value.connectionTestInvalidBaseURL
    case 'auth':
      return dialogs.value.connectionTestAuthFailed
    case 'model-not-found':
      return dialogs.value.connectionTestModelNotFound
    case 'api-type':
      return dialogs.value.connectionTestAPITypeMismatch
    case 'browser-network':
      return dialogs.value.connectionTestBrowserNetworkFailed
    case 'network':
      return dialogs.value.connectionTestNetworkFailed
    default:
      return dialogs.value.connectionTestUnknownFailed
  }
})

const isTesting = computed(() => status === 'testing')
const resultTone = computed(() => (status === 'success' ? 'success' : 'error'))
const statusStyles = computed(() => tv(statusTheme)({ tone: resultTone.value }))
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      type="button"
      data-test-id="provider-test-connection"
      class="rounded border border-panel bg-panel px-2 py-1 text-[11px] font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="isTesting || disabled"
      @click="emit('test')"
    >
      <span class="inline-flex items-center justify-center gap-1.5">
        <icon-lucide-loader-2 v-if="isTesting" class="size-3 animate-spin" />
        <icon-lucide-plug-zap v-else class="size-3" />
        {{ isTesting ? dialogs.testingConnection : dialogs.testConnection }}
      </span>
    </button>

    <p
      v-if="resultMessage"
      :data-tone="resultTone"
      :class="statusStyles.text()"
      data-test-id="provider-test-connection-result"
    >
      {{ resultMessage }}
    </p>
  </div>
</template>
