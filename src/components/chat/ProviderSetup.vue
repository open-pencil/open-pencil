<script setup lang="ts">
import { computed } from 'vue'

import { ACP_AGENTS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { useAIChat } from '@/app/ai/chat/use'
import { openSettingsDialog } from '@/app/shell/settings-dialog'

const { providerID } = useAIChat()
const { dialogs } = useI18n()

const isACP = computed(() => providerID.value.startsWith('acp:'))
const acpAgent = computed(() => {
  if (!isACP.value) return null
  const id = providerID.value.replace('acp:', '')
  return ACP_AGENTS.find((a) => a.id === id) ?? null
})
</script>

<template>
  <div data-test-id="provider-setup" class="flex flex-1 flex-col items-center justify-center px-6">
    <icon-lucide-sparkles class="mb-3 size-7 text-muted" />
    <p class="mb-5 text-center text-xs text-muted">{{ dialogs.connectAIProvider }}</p>

    <!-- ACP agent — no API key needed; keep the first-run instructions -->
    <p v-if="isACP" class="mb-4 text-center text-[10px] leading-relaxed text-muted">
      Uses your existing {{ acpAgent?.name }} subscription.
      <template v-if="acpAgent?.installCommand">
        Install it with
        <code class="rounded bg-input px-1 py-0.5 font-mono text-[9px]">{{
          acpAgent.installCommand
        }}</code>
        and sign in before sending your first message.
      </template>
      <template v-else>
        Make sure
        <code class="rounded bg-input px-1 py-0.5 font-mono text-[9px]">{{
          acpAgent?.command
        }}</code>
        is installed and authenticated.
      </template>
    </p>

    <!-- Provider configuration lives in one place: Settings → AI -->
    <button
      type="button"
      data-test-id="provider-setup-open-settings"
      class="w-full rounded bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent/90"
      @click="openSettingsDialog('ai')"
    >
      {{ dialogs.openAISettings }}
    </button>
  </div>
</template>
