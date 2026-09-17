<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import type { MCPFailure, MCPFailureCode } from '@/app/automation/mcp/failure'
import { toast } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

const {
  failure,
  restarting = false,
  externallyManaged = false
} = defineProps<{
  failure: MCPFailure
  restarting?: boolean
  externallyManaged?: boolean
}>()
const emit = defineEmits<{ restart: [] }>()

const automation = useAutomationMessages()
const { copy } = useClipboard()
const detailsOpen = ref(false)

/** Translated copy for each reason; the technical detail stays secondary. */
const copy$ = computed(() => {
  const messages = automation.value
  const packageName = failure.detail ?? 'MCP package'
  const map: Record<MCPFailureCode, { heading: string; description: string }> = {
    'not-installed': {
      heading: messages.mcpFailureNotInstalled,
      description: messages.mcpFailureNotInstalledHint({ package: packageName })
    },
    'permission-denied': {
      heading: messages.mcpFailurePermission,
      description: messages.mcpFailurePermissionHint
    },
    exited: { heading: messages.mcpFailureExited, description: messages.mcpFailureExitedHint },
    timeout: { heading: messages.mcpFailureTimeout, description: messages.mcpFailureTimeoutHint },
    rejected: {
      heading: messages.mcpFailureRejected,
      description: messages.mcpFailureRejectedHint
    },
    malformed: {
      heading: messages.mcpFailureMalformed,
      description: messages.mcpFailureMalformedHint
    },
    unreachable: {
      heading: messages.mcpFailureUnreachable,
      description: messages.mcpFailureUnreachableHint({
        endpoint: failure.detail ?? 'the local server'
      })
    },
    unknown: { heading: messages.mcpFailureUnknown, description: messages.mcpFailureUnknownHint }
  }
  return map[failure.code]
})

/**
 * Reasons whose cause already appears in the guidance, so repeating the same
 * value under Details would only add noise.
 */
const EXPLAINED_REASONS: ReadonlySet<MCPFailureCode> = new Set([
  'not-installed',
  'rejected',
  'unreachable'
])

const detail = computed(() =>
  EXPLAINED_REASONS.has(failure.code) ? null : failure.detail?.trim() || null
)

function copyDetails(): void {
  const payload = [`code=${failure.code}`, failure.detail ? `detail=${failure.detail}` : null]
    .filter(Boolean)
    .join('\n')
  copy(payload)
  toast.info(automation.value.mcpFailureCopied)
}
</script>

<template>
  <AppAlert
    tone="error"
    :heading="copy$.heading"
    :description="copy$.description"
    data-test-id="settings-mcp-failure"
  >
    <template v-if="detail" #details>
      <AppCollapsible
        v-model:open="detailsOpen"
        :label="automation.mcpFailureDetails"
        :ui="{ trigger: 'text-muted hover:text-surface', content: 'mt-1' }"
        data-test-id="settings-mcp-failure-details"
      >
        <pre
          class="max-h-40 overflow-auto rounded border border-border bg-input p-2 font-mono text-[11px] whitespace-pre-wrap text-muted"
          data-test-id="settings-mcp-failure-detail"
          >{{ detail }}</pre>
      </AppCollapsible>
    </template>
    <template #actions>
      <AppButton size="xs" variant="outline" @click="copyDetails">{{
        automation.mcpFailureCopy
      }}</AppButton>
      <AppButton
        size="xs"
        variant="outline"
        :disabled="externallyManaged"
        :loading="restarting"
        @click="emit('restart')"
        >{{ externallyManaged ? automation.externallyManaged : automation.restart }}</AppButton
      >
    </template>
  </AppAlert>
</template>
