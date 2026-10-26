<script setup lang="ts">
import { computed } from 'vue'

import {
  useAIMessages,
  useAutomationMessages,
  useCommonMessages,
  useSettingsMessages
} from '@open-pencil/vue/i18n'

import { useMCPServerSetup } from '@/app/ai/agents/setup/use'
import { restartFixesMCPFailure } from '@/app/automation/mcp/failure'
import {
  mcpAuthenticationEnabled,
  mcpRootDirectory,
  mcpSelectionOnly
} from '@/app/automation/mcp/preferences'
import { localMCPAvailable, mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { needsMCPInstall } from '@/app/automation/mcp/setup-prompt'
import { openToolAccessSettings, toolAccessCounts } from '@/app/automation/tool-access/settings/use'
import { isTauri } from '@/app/tauri/env'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppStatus from '@/components/ui/feedback/AppStatus.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import { DESKTOP_DOWNLOAD_URL, MCP_SERVER_DOCS_URL } from '@/constants'

import MCPFailureAlert from './MCPFailureAlert.vue'

const automation = useAutomationMessages()
const settings = useSettingsMessages()
const common = useCommonMessages()
const ai = useAIMessages()
const available = localMCPAvailable()
const restarting = computed(() => mcpRuntime.status === 'starting' || mcpRuntime.checking)
const alertRestarts = computed(() =>
  Boolean(mcpRuntime.failure && restartFixesMCPFailure(mcpRuntime.failure))
)
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
const statusTone = computed(
  () =>
    (
      ({
        idle: 'neutral',
        starting: 'pending',
        running: 'success',
        stopped: 'neutral',
        error: 'error'
      }) as const
    )[mcpRuntime.status]
)
const { restart, chooseRootDirectory } = useMCPSettings()
// Checked only while the failure is one an install fixes.
const serverSetup = useMCPServerSetup(() =>
  Boolean(mcpRuntime.failure && needsMCPInstall(mcpRuntime.failure))
)
</script>

<template>
  <SettingsSection data-test-id="settings-mcp-automation-panel">
    <template #title>{{ automation.localServer }}</template>
    <template #description>
      {{ automation.description }}
      <SettingsLink :href="MCP_SERVER_DOCS_URL">{{ common.learnMore }}</SettingsLink>
    </template>
    <!-- While the alert offers Restart as its fix, it is the only Restart on the page. -->
    <template v-if="available && !alertRestarts" #actions>
      <AppButton
        variant="outline"
        :disabled="mcpRuntime.externallyManaged"
        :loading="restarting"
        data-test-id="settings-mcp-restart"
        @click="restart"
      >
        {{ mcpRuntime.externallyManaged ? automation.externallyManaged : automation.restart }}
      </AppButton>
    </template>
    <AppAlert v-if="!available" :heading="automation.localServerDesktopOnly">
      <template #actions>
        <SettingsLink :href="DESKTOP_DOWNLOAD_URL">{{ ai.aiSetupGetDesktop }}</SettingsLink>
      </template>
    </AppAlert>
    <template v-else>
      <SettingsGroup data-slot="mcp-server-status">
        <SettingsRow>
          <template #label>
            <AppStatus :tone="statusTone">{{ statusMessage }}</AppStatus>
          </template>
          <template v-if="mcpRuntime.version" #description>
            <span class="mt-1 block text-[11px] text-muted"
              >{{ automation.version }} <code>{{ mcpRuntime.version }}</code></span
            >
          </template>
        </SettingsRow>
        <div class="px-3 py-2.5">
          <AppCopyField
            :value="mcpRuntime.endpoint"
            :copy-label="common.copy"
            :copied-label="common.copied"
            :ui="{ value: 'truncate' }"
          />
        </div>
      </SettingsGroup>
      <SettingsGroup>
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
        <SettingsRow
          :label="automation.selectionScope"
          :description="automation.selectionScopeDescription"
        >
          <AppSwitch
            v-model="mcpSelectionOnly"
            :label="automation.selectionScope"
            data-test-id="settings-mcp-selection-scope"
          />
        </SettingsRow>
        <SettingsRow :label="automation.rootDirectory">
          <template #description>
            <code class="mt-1 block text-[11px] break-all text-surface">{{
              mcpRootDirectory || automation.rootDirectoryDefault
            }}</code>
            <span class="mt-1 block text-[11px] leading-relaxed text-muted">{{
              automation.rootDirectoryDescription
            }}</span>
          </template>
          <div v-if="mcpRootDirectory || isTauri()" class="flex flex-wrap justify-end gap-2">
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
        </SettingsRow>
        <SettingsRow
          :label="settings.toolAccess"
          :description="automation.toolsEnabled(toolAccessCounts.mcp)"
        >
          <AppButton
            size="xs"
            variant="outline"
            data-test-id="settings-mcp-tool-access"
            @click="openToolAccessSettings('mcp')"
            >{{ settings.edit }}</AppButton
          >
        </SettingsRow>
      </SettingsGroup>
      <MCPFailureAlert
        v-if="mcpRuntime.failure"
        :failure="mcpRuntime.failure"
        :setup="serverSetup.state.value"
        :restarting="restarting"
        :externally-managed="mcpRuntime.externallyManaged"
        @install="serverSetup.install"
        @restart="restart"
        @check="serverSetup.check"
      />
    </template>
  </SettingsSection>
</template>
