<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { compact } from 'es-toolkit/array'
import { computed, ref } from 'vue'

import { useAutomationMessages, useI18n } from '@open-pencil/vue/i18n'

import { mcpServerSetupView, type MCPServerSetupState } from '@/app/ai/agents/setup/view'
import {
  restartFixesMCPFailure,
  type MCPFailure,
  type MCPFailureCode
} from '@/app/automation/mcp/failure'
import { mcpServerSetupPrompt, needsMCPInstall } from '@/app/automation/mcp/setup-prompt'
import { APP_VERSION } from '@/app/runtime/version'
import { useSetupProblemMessage } from '@/components/settings/agents/problem'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import { NODE_DOWNLOAD_URL } from '@/constants'

/** Where one-click installation is unavailable, only the manual fallback applies. */
const MANUAL_SETUP: MCPServerSetupState = {
  supported: false,
  checked: true,
  bridge: false,
  bridgeOutdated: false,
  bridgeCommand: '',
  npm: false,
  installingBridge: false,
  error: null
}

// The alert carries the fix: install or update, or restart where that is what fixes it; the
// section header hides its own Restart while the alert offers one.
const {
  failure,
  setup,
  restarting = false,
  externallyManaged = false
} = defineProps<{
  failure: MCPFailure
  /** The MCP server's install state, for one-click installation on the desktop. */
  setup?: MCPServerSetupState
  restarting?: boolean
  externallyManaged?: boolean
}>()
const emit = defineEmits<{ install: []; restart: []; check: [] }>()
const restartFixes = computed(() => restartFixesMCPFailure(failure))

const automation = useAutomationMessages()
const { ai, common } = useI18n()
const setupProblemMessage = useSetupProblemMessage()
const { copy: copyDetailsText, copied: detailsCopied } = useClipboard({ copiedDuring: 1500 })
const { copy: copyPrompt, copied: promptCopied } = useClipboard({ copiedDuring: 1500 })
const detailsOpen = ref(false)

/** One-click install or update first; a command and an agent prompt only where it cannot help. */
const installView = computed(() =>
  needsMCPInstall(failure) ? mcpServerSetupView(setup ?? MANUAL_SETUP) : null
)
const installAction = computed(() => {
  const bridge = installView.value?.bridge
  if (!bridge?.action) return null
  if (bridge.installing) {
    return bridge.action === 'update'
      ? automation.value.mcpUpdating
      : ai.value.aiSetupAgentInstalling
  }
  return bridge.action === 'update'
    ? ai.value.aiSetupAgentUpdateMCP
    : ai.value.aiSetupAgentInstallMCP
})
const problem = computed(() => installView.value?.problem ?? null)
const manualCommand = computed(() => installView.value?.manualCommand ?? null)

/** Translated copy for each reason; the technical detail stays secondary. */
const copy$ = computed(() => {
  const messages = automation.value
  const map: Record<MCPFailureCode, { heading: string; description: string }> = {
    'not-installed': {
      heading: messages.mcpFailureNotInstalled,
      description: messages.mcpFailureNotInstalledHint
    },
    outdated: {
      heading: messages.mcpFailureOutdated,
      description: messages.mcpFailureOutdatedHint({
        running: failure.detail ? `v${failure.detail}` : 'an older version',
        version: `v${APP_VERSION}`
      })
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
  'outdated',
  'rejected',
  'unreachable'
])

const detail = computed(() =>
  EXPLAINED_REASONS.has(failure.code) ? null : failure.detail?.trim() || null
)

async function copyDetails(): Promise<void> {
  const payload = compact([
    `code=${failure.code}`,
    failure.detail ? `detail=${failure.detail}` : null
  ]).join('\n')
  await copyDetailsText(payload)
}
</script>

<template>
  <AppAlert
    tone="error"
    :heading="copy$.heading"
    :description="copy$.description"
    data-test-id="settings-mcp-failure"
  >
    <template v-if="problem || manualCommand || detail" #details>
      <!-- Guidance reads like the description; only the heading carries the error colour. -->
      <div class="flex flex-col gap-2 leading-relaxed text-surface">
        <p v-if="problem" data-test-id="settings-mcp-install-problem">
          {{ setupProblemMessage(problem) }}
          <SettingsLink v-if="problem === 'needs-npm'" :href="NODE_DOWNLOAD_URL"
            >Node.js</SettingsLink
          >
        </p>
        <template v-if="manualCommand">
          <p>{{ automation.mcpInstallByHand }}</p>
          <AppCopyField
            :value="manualCommand"
            :copy-label="common.copy"
            :copied-label="common.copied"
            data-test-id="settings-mcp-install-command"
          />
        </template>
        <AppCollapsible
          v-if="detail"
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
      </div>
    </template>
    <template #actions>
      <AppButton
        v-if="installAction"
        size="xs"
        color="primary"
        variant="solid"
        :loading="installView?.bridge.installing"
        data-test-id="settings-mcp-install"
        @click="emit('install')"
        >{{ installAction }}</AppButton
      >
      <AppButton
        v-if="manualCommand"
        size="xs"
        :color="installAction ? 'neutral' : 'primary'"
        :variant="installAction ? 'outline' : 'solid'"
        data-test-id="settings-mcp-copy-agent-prompt"
        @click="copyPrompt(mcpServerSetupPrompt(failure, manualCommand))"
      >
        <template #leading>
          <icon-lucide-check v-if="promptCopied" class="size-3" />
          <icon-lucide-copy v-else class="size-3" />
        </template>
        {{ promptCopied ? common.copied : automation.mcpCopyAgentPrompt }}
      </AppButton>
      <AppButton
        v-if="restartFixes"
        size="xs"
        color="primary"
        variant="solid"
        :disabled="externallyManaged"
        :loading="restarting"
        data-test-id="settings-mcp-restart"
        @click="emit('restart')"
        >{{ externallyManaged ? automation.externallyManaged : automation.restart }}</AppButton
      >
      <AppButton
        v-if="problem === 'needs-npm'"
        size="xs"
        variant="outline"
        data-test-id="settings-mcp-check-again"
        @click="emit('check')"
        >{{ ai.aiSetupAgentCheckAgain }}</AppButton
      >
      <AppButton size="xs" variant="outline" @click="copyDetails">
        <template #leading>
          <icon-lucide-check v-if="detailsCopied" class="size-3" />
          <icon-lucide-copy v-else class="size-3" />
        </template>
        {{ detailsCopied ? common.copied : automation.mcpFailureCopy }}
      </AppButton>
    </template>
  </AppAlert>
</template>
