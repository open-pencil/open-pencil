<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import { useAutomationMessages, useCommonMessages, useSettingsMessages } from '@open-pencil/vue'

import type { MCPFailureCode } from '@/app/automation/mcp/failure'
import { mcpAuthenticationEnabled, mcpRootDirectory } from '@/app/automation/mcp/preferences'
import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { openToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import { toast } from '@/app/shell/ui'
import { isTauri } from '@/app/tauri/env'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const automation = useAutomationMessages()
const settings = useSettingsMessages()
const common = useCommonMessages()
const { copy, copied } = useClipboard()
const statusMessage = computed(
  () =>
    ({
      idle: automation.value.statusIdle,
      starting: automation.value.statusStarting,
      running: automation.value.statusRunning,
      stopped: automation.value.statusStopped,
      error: automation.value.statusError
    })[mcpRuntime.status]
)
const { restart, chooseRootDirectory } = useMCPSettings()

/** Translated copy for each startup reason; the technical detail stays secondary. */
const failureCopy = computed(() => {
  const failure = mcpRuntime.failure
  if (!failure) return null
  const messages = automation.value
  const copy: Record<MCPFailureCode, { heading: string; description: string }> = {
    'not-installed': {
      heading: messages.mcpFailureNotInstalled,
      description: messages.mcpFailureNotInstalledHint({ package: failure.detail ?? 'MCP package' })
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
        endpoint: failure.detail ?? mcpRuntime.endpoint
      })
    },
    unknown: { heading: messages.mcpFailureUnknown, description: messages.mcpFailureUnknownHint }
  }
  return copy[failure.code]
})

/** Only non-actionable reasons (exit/timeout/unknown) carry technical output. */
const failureDetail = computed(() => {
  const failure = mcpRuntime.failure
  if (!failure) return null
  const code = failure.code
  // These reasons already carry their detail in the translated guidance.
  if (code === 'not-installed' || code === 'rejected' || code === 'unreachable') return null
  return failure.detail?.trim() || null
})
const detailsOpen = ref(false)

function copyFailureDetails(): void {
  const failure = mcpRuntime.failure
  if (!failure) return
  const payload = [`code=${failure.code}`, failure.detail ? `detail=${failure.detail}` : null]
    .filter(Boolean)
    .join('\n')
  copy(payload)
  toast.info(automation.value.mcpFailureCopied)
}
</script>

<template>
  <SettingsSection data-test-id="settings-mcp-automation-panel">
    <template #title>{{ automation.localServer }}</template>
    <template #description>{{ automation.description }}</template>
    <SettingsGroup>
      <SettingsRow :label="automation.status"
        ><span class="text-xs text-surface" role="status">{{ statusMessage }}</span></SettingsRow
      >
      <div class="px-3 py-2.5">
        <p class="mb-1 text-xs font-medium text-surface">{{ automation.address }}</p>
        <div class="flex items-center justify-between gap-2">
          <code class="min-w-0 select-all break-all text-xs text-surface">{{
            mcpRuntime.endpoint
          }}</code>
          <AppButton size="xs" variant="link" @click="copy(mcpRuntime.endpoint)">{{
            copied ? common.copied : common.copy
          }}</AppButton>
        </div>
      </div>
      <SettingsRow v-if="mcpRuntime.version" :label="automation.version"
        ><code class="text-xs text-surface">{{ mcpRuntime.version }}</code></SettingsRow
      >
      <SettingsRow
        :label="automation.authentication"
        :description="automation.authenticationDescription"
      >
        <AppSwitch
          v-model="mcpAuthenticationEnabled"
          :label="automation.authentication"
          data-test-id="settings-mcp-authentication"
        />
      </SettingsRow>
      <div class="flex flex-col gap-2 px-3 py-2.5">
        <p class="text-xs font-medium text-surface">{{ automation.rootDirectory }}</p>
        <p class="break-all font-mono text-xs text-surface">
          {{ mcpRootDirectory || automation.rootDirectoryDefault }}
        </p>
        <p class="text-xs leading-relaxed text-muted">
          {{ automation.rootDirectoryDescription }}
        </p>
        <div v-if="mcpRootDirectory || isTauri()" class="flex flex-wrap gap-2">
          <AppButton
            v-if="mcpRootDirectory"
            size="xs"
            variant="outline"
            @click="mcpRootDirectory = ''"
            >{{ automation.useDefaultRoot }}</AppButton
          >
          <AppButton
            v-if="isTauri()"
            size="xs"
            variant="outline"
            data-test-id="settings-mcp-root-directory"
            @click="chooseRootDirectory"
            >{{ automation.chooseRootDirectory }}</AppButton
          >
        </div>
      </div>
    </SettingsGroup>
    <AppAlert
      v-if="failureCopy"
      tone="error"
      :heading="failureCopy.heading"
      :description="failureCopy.description"
      data-test-id="settings-mcp-failure"
    >
      <template v-if="failureDetail" #details>
        <AppCollapsible
          v-model:open="detailsOpen"
          :label="automation.mcpFailureDetails"
          :ui="{ trigger: 'text-muted hover:text-surface', content: 'mt-1' }"
          data-test-id="settings-mcp-failure-details"
        >
          <pre
            class="max-h-40 overflow-auto rounded border border-border bg-input p-2 font-mono text-[11px] whitespace-pre-wrap text-muted"
            data-test-id="settings-mcp-failure-detail"
            >{{ failureDetail }}</pre>
        </AppCollapsible>
      </template>
      <template #actions>
        <AppButton size="xs" variant="outline" @click="copyFailureDetails">{{
          automation.mcpFailureCopy
        }}</AppButton>
        <AppButton
          size="xs"
          variant="outline"
          :disabled="mcpRuntime.externallyManaged"
          :loading="mcpRuntime.status === 'starting' || mcpRuntime.checking"
          @click="restart"
          >{{
            mcpRuntime.externallyManaged ? automation.externallyManaged : automation.restart
          }}</AppButton
        >
      </template>
    </AppAlert>
    <div>
      <AppButton variant="link" @click="openToolAccessSettings('mcp')">{{
        settings.toolAccess
      }}</AppButton>
    </div>
    <!-- The failure alert carries its own restart action. -->
    <div v-if="!failureCopy">
      <AppButton
        color="primary"
        variant="solid"
        :disabled="mcpRuntime.externallyManaged"
        :loading="mcpRuntime.status === 'starting' || mcpRuntime.checking"
        data-test-id="settings-mcp-restart"
        @click="restart"
      >
        {{ mcpRuntime.externallyManaged ? automation.externallyManaged : automation.restart }}
      </AppButton>
    </div>
  </SettingsSection>
</template>
