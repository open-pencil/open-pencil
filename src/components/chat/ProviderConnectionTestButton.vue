<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { ProviderConnectionTestFailureReason } from '@/app/ai/chat/connection-test'
import AppButton from '@/components/ui/button/AppButton.vue'
import statusTheme from '@/theme/feedback/status'

interface ProviderConnectionTestButtonProps {
  status: 'idle' | 'testing' | 'success' | 'error'
  reason?: ProviderConnectionTestFailureReason | null
  disabled?: boolean
}

const { status, reason, disabled = false } = defineProps<ProviderConnectionTestButtonProps>()
const emit = defineEmits<{ test: [] }>()
const { ai, common } = useI18n()

const resultMessage = computed(() => {
  if (status === 'success') return ai.value.connectionTestSuccess
  if (status !== 'error') return null

  switch (reason) {
    case 'missing-api-key':
      return ai.value.connectionTestMissingAPIKey
    case 'missing-base-url':
      return ai.value.connectionTestMissingBaseURL
    case 'missing-model':
      return ai.value.connectionTestMissingModel
    case 'invalid-base-url':
      return ai.value.connectionTestInvalidBaseURL
    case 'auth':
      return ai.value.connectionTestAuthFailed
    case 'insufficient-credit':
      return ai.value.connectionTestInsufficientCredit
    case 'model-not-found':
      return ai.value.connectionTestModelNotFound
    case 'api-type':
      return ai.value.connectionTestAPITypeMismatch
    case 'browser-network':
      return ai.value.connectionTestBrowserNetworkFailed
    case 'network':
      return ai.value.connectionTestNetworkFailed
    default:
      return ai.value.connectionTestUnknownFailed
  }
})

const isTesting = computed(() => status === 'testing')
const resultTone = computed(() => (status === 'success' ? 'success' : 'error'))
const statusStyles = computed(() => tv(statusTheme)({ tone: resultTone.value }))
</script>

<template>
  <div class="flex flex-col gap-1">
    <AppButton
      variant="outline"
      data-test-id="provider-test-connection"
      :loading="isTesting"
      :disabled="disabled"
      @click="emit('test')"
    >
      <template #leading><icon-lucide-plug-zap class="size-3" /></template>
      {{ isTesting ? common.testingConnection : common.testConnection }}
    </AppButton>

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
