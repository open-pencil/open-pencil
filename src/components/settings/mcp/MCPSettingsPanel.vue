<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  configurableMCPTools,
  disabledMCPTools,
  mcpAuthenticationEnabled,
  mcpRootDirectory,
  setMCPToolCategoryEnabled,
  setMCPToolEnabled
} from '@/app/automation/mcp/preferences'
import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { isTauri } from '@/app/tauri/env'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

const { settings, automation, common } = useI18n()
const statusMessage = computed(() => {
  switch (mcpRuntime.status) {
    case 'idle':
      return automation.value.statusIdle
    case 'starting':
      return automation.value.statusStarting
    case 'running':
      return automation.value.statusRunning
    case 'stopped':
      return automation.value.statusStopped
    case 'error':
      return automation.value.statusError
    default:
      return automation.value.statusIdle
  }
})

const {
  toolSearch,
  inspectionToolsStatus,
  modificationToolsStatus,
  enabledToolCount,
  visibleTools,
  restart,
  chooseRootDirectory,
  isToolEnabled,
  enableAllTools
} = useMCPSettings()
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-mcp-automation-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ settings.automation }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ automation.description }}</p>
    </div>

    <div class="rounded border border-border bg-panel p-3 text-[11px]">
      <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        <dt class="text-muted">{{ automation.status }}</dt>
        <dd class="flex items-center gap-2 text-surface">
          <span
            class="size-2 rounded-full"
            :class="
              mcpRuntime.status === 'running'
                ? 'bg-green-500'
                : mcpRuntime.status === 'error'
                  ? 'bg-red-500'
                  : 'bg-muted'
            "
          />
          {{ statusMessage }}
        </dd>
        <dt class="text-muted">{{ automation.port }}</dt>
        <dd class="font-mono text-surface">{{ mcpRuntime.port }}</dd>
        <dt class="text-muted">{{ automation.address }}</dt>
        <dd class="select-all font-mono text-surface">127.0.0.1</dd>
        <template v-if="mcpRuntime.version">
          <dt class="text-muted">{{ automation.version }}</dt>
          <dd class="font-mono text-surface">{{ mcpRuntime.version }}</dd>
        </template>
      </dl>

      <div class="mt-3 border-t border-border pt-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-medium text-surface">{{ automation.authentication }}</p>
            <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
              {{ automation.authenticationDescription }}
            </p>
          </div>
          <AppSwitch
            v-model="mcpAuthenticationEnabled"
            :label="automation.authentication"
            data-test-id="settings-mcp-authentication"
          />
        </div>
      </div>

      <div class="mt-3 border-t border-border pt-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-medium text-surface">{{ automation.rootDirectory }}</p>
            <p class="mt-0.5 truncate font-mono text-[10px] text-muted">
              {{ mcpRootDirectory || automation.rootDirectoryDefault }}
            </p>
          </div>
          <div class="flex shrink-0 gap-1.5">
            <AppButton
              v-if="mcpRootDirectory"
              size="xs"
              variant="outline"
              @click="mcpRootDirectory = ''"
            >
              {{ automation.useDefaultRoot }}
            </AppButton>
            <AppButton
              v-if="isTauri()"
              size="xs"
              variant="outline"
              data-test-id="settings-mcp-root-directory"
              @click="chooseRootDirectory"
            >
              {{ automation.chooseRootDirectory }}
            </AppButton>
          </div>
        </div>
        <p class="mt-1.5 text-[10px] leading-relaxed text-muted">
          {{ automation.rootDirectoryDescription }}
        </p>
      </div>
    </div>

    <p
      v-if="mcpRuntime.error"
      class="rounded border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-400"
    >
      {{ mcpRuntime.error }}
    </p>

    <div class="overflow-hidden rounded border border-border bg-panel">
      <div class="flex items-start justify-between gap-4 border-b border-border p-3">
        <div>
          <h4 class="text-[11px] font-medium text-surface">{{ automation.tools }}</h4>
          <p class="mt-0.5 text-[10px] text-muted">
            {{
              automation.toolsEnabled({
                enabled: enabledToolCount,
                total: configurableMCPTools.length
              })
            }}
          </p>
        </div>
        <AppButton
          v-if="disabledMCPTools.length"
          size="xs"
          color="primary"
          variant="link"
          @click="enableAllTools"
        >
          {{ automation.enableAllTools }}
        </AppButton>
      </div>

      <div class="border-b border-border p-2">
        <AppInput
          v-model="toolSearch"
          type="search"
          size="sm"
          :placeholder="common.search"
          :aria-label="automation.searchTools"
          data-test-id="settings-mcp-tool-search"
        />
      </div>

      <div class="grid grid-cols-2 gap-2 border-b border-border p-2.5">
        <div class="flex items-center justify-between gap-2 rounded bg-input px-2.5 py-2">
          <span class="text-[10px] text-surface">{{ automation.readOnlyTools }}</span>
          <AppSwitch
            :model-value="inspectionToolsStatus.enabled"
            :state="inspectionToolsStatus.state"
            :label="automation.readOnlyTools"
            data-test-id="settings-mcp-inspection-tools"
            @update:model-value="setMCPToolCategoryEnabled('read', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-2 rounded bg-input px-2.5 py-2">
          <span class="text-[10px] text-surface">{{ automation.sideEffectTools }}</span>
          <AppSwitch
            :model-value="modificationToolsStatus.enabled"
            :state="modificationToolsStatus.state"
            :label="automation.sideEffectTools"
            data-test-id="settings-mcp-modification-tools"
            @update:model-value="setMCPToolCategoryEnabled('write', $event)"
          />
        </div>
      </div>

      <ul class="max-h-72 divide-y divide-border overflow-y-auto">
        <li v-for="tool in visibleTools" :key="tool.name" class="flex items-start gap-3 p-2.5">
          <div class="min-w-0 flex-1">
            <code class="text-[10px] font-medium text-surface">{{ tool.name }}</code>
            <p class="mt-0.5 text-[10px] leading-relaxed text-muted">{{ tool.description }}</p>
          </div>
          <AppSwitch
            :model-value="isToolEnabled(tool.name)"
            :label="tool.name"
            :data-test-id="`settings-mcp-tool-${tool.name}`"
            @update:model-value="setMCPToolEnabled(tool.name, $event)"
          />
        </li>
      </ul>

      <p class="border-t border-border px-3 py-2 text-[10px] text-muted">
        {{
          mcpRuntime.externallyManaged
            ? automation.externalRestartNotice
            : automation.toolsRestartNotice
        }}
      </p>
    </div>

    <div>
      <AppButton
        color="primary"
        variant="solid"
        :disabled="mcpRuntime.status === 'starting' || mcpRuntime.externallyManaged"
        data-test-id="settings-mcp-restart"
        @click="restart"
      >
        {{
          mcpRuntime.status === 'starting' || mcpRuntime.checking
            ? automation.starting
            : mcpRuntime.externallyManaged
              ? automation.externallyManaged
              : automation.restart
        }}
      </AppButton>
    </div>
  </section>
</template>
