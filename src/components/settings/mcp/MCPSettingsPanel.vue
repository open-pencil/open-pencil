<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'

import { useAutomationMessages, useCommonMessages, useSettingsMessages } from '@open-pencil/vue'

import { mcpAuthenticationEnabled, mcpRootDirectory } from '@/app/automation/mcp/preferences'
import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { openToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import { isTauri } from '@/app/tauri/env'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

import MCPFailureAlert from './MCPFailureAlert.vue'

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
    <MCPFailureAlert
      v-if="mcpRuntime.failure"
      :failure="mcpRuntime.failure"
      :restarting="mcpRuntime.status === 'starting' || mcpRuntime.checking"
      :externally-managed="mcpRuntime.externallyManaged"
      @restart="restart"
    />
    <div>
      <AppButton variant="link" @click="openToolAccessSettings('mcp')">{{
        settings.toolAccess
      }}</AppButton>
    </div>
    <!-- The failure alert carries its own restart action. -->
    <div v-if="!mcpRuntime.failure">
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
