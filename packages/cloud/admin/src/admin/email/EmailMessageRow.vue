<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import type { TransactionalEmailAdmin } from '@open-pencil/cloud/contract'

const { message, busy, regenerateLabel, attemptsLabel, noErrorLabel } = defineProps<{
  message: TransactionalEmailAdmin
  busy: boolean
  regenerateLabel: string
  attemptsLabel: string
  noErrorLabel: string
}>()
const emit = defineEmits<{ regenerate: [] }>()
</script>

<template>
  <article class="rounded-lg border border-border bg-panel p-4">
    <div class="flex items-center justify-between gap-3 text-sm">
      <strong class="truncate">{{ message.kind }}</strong>
      <span class="text-muted">{{ message.status }}</span>
    </div>
    <div class="mt-1 truncate text-xs text-muted">
      {{ message.recipientEmailNormalized }} · {{ attemptsLabel }} ·
      {{ message.lastErrorCode ?? noErrorLabel }}
    </div>
    <AppButton
      v-if="message.status === 'failed' && message.regeneratable"
      class="mt-3"
      variant="outline"
      size="xs"
      :loading="busy"
      @click="emit('regenerate')"
    >
      {{ regenerateLabel }}
    </AppButton>
  </article>
</template>
