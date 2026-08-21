<script setup lang="ts">
import type { ToolEffect } from '@open-pencil/mcp/tools'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import {
  configurableMCPTools,
  disabledMCPTools,
  mcpAuthenticationEnabled,
  mcpRootDirectory,
  setMCPToolCategoryEnabled,
  setMCPToolEnabled
} from '@/app/automation/mcp/preferences'
import { mcpRuntime, refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'
import { isTauri } from '@/app/tauri/env'
import AppInput from '@/components/ui/AppInput.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'

const { settings, automation, common } = useI18n()
const toolSearch = ref('')
const disabledToolNames = computed(() => new Set(disabledMCPTools.value))
function categoryStatus(effect: ToolEffect) {
  const tools = configurableMCPTools.value.filter((tool) => tool.effect === effect)
  const enabled = tools.filter((tool) => !disabledToolNames.value.has(tool.name)).length
  return {
    enabled: enabled > 0,
    state: enabled > 0 && enabled < tools.length ? ('mixed' as const) : ('idle' as const)
  }
}
const inspectionToolsStatus = computed(() => categoryStatus('read'))
const modificationToolsStatus = computed(() => categoryStatus('write'))
const enabledToolCount = computed(
  () => configurableMCPTools.value.filter((tool) => !disabledToolNames.value.has(tool.name)).length
)
const visibleTools = computed(() => {
  const query = toolSearch.value.trim().toLowerCase()
  if (!query) return configurableMCPTools.value
  return configurableMCPTools.value.filter(
    (tool) =>
      tool.name.toLowerCase().includes(query) || tool.description.toLowerCase().includes(query)
  )
})

onMounted(() => {
  void refreshMCPRuntime()
})

function restart(): void {
  void restartMCPRuntime()
}

async function chooseRootDirectory(): Promise<void> {
  if (!isTauri()) return
  const { open } = await import('@tauri-apps/plugin-dialog')
  const directory = await open({ directory: true, multiple: false })
  if (typeof directory === 'string') mcpRootDirectory.value = directory
}

function isToolEnabled(name: string): boolean {
  return !disabledToolNames.value.has(name)
}

function enableAllTools(): void {
  disabledMCPTools.value = []
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-mcp-automation-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ settings.settingsMCP }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ automation.mcpDescription }}</p>
    </div>

    <div class="rounded border border-border bg-panel p-3 text-[11px]">
      <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        <dt class="text-muted">{{ automation.mcpStatus }}</dt>
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
          {{ automation[`mcpStatus_${mcpRuntime.status}`] }}
        </dd>
        <dt class="text-muted">{{ automation.mcpPort }}</dt>
        <dd class="font-mono text-surface">{{ mcpRuntime.port }}</dd>
        <dt class="text-muted">{{ automation.mcpAddress }}</dt>
        <dd class="select-all font-mono text-surface">127.0.0.1</dd>
        <template v-if="mcpRuntime.version">
          <dt class="text-muted">{{ automation.mcpVersion }}</dt>
          <dd class="font-mono text-surface">{{ mcpRuntime.version }}</dd>
        </template>
      </dl>

      <div class="mt-3 border-t border-border pt-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-medium text-surface">{{ automation.mcpAuthentication }}</p>
            <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
              {{ automation.mcpAuthenticationDescription }}
            </p>
          </div>
          <AppSwitch
            v-model="mcpAuthenticationEnabled"
            :label="automation.mcpAuthentication"
            data-test-id="settings-mcp-authentication"
          />
        </div>
      </div>

      <div class="mt-3 border-t border-border pt-3">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-medium text-surface">{{ automation.mcpRootDirectory }}</p>
            <p class="mt-0.5 truncate font-mono text-[10px] text-muted">
              {{ mcpRootDirectory || automation.mcpRootDirectoryDefault }}
            </p>
          </div>
          <div class="flex shrink-0 gap-1.5">
            <button
              v-if="mcpRootDirectory"
              type="button"
              class="rounded border border-border px-2 py-1 text-[10px] text-muted hover:bg-hover hover:text-surface"
              @click="mcpRootDirectory = ''"
            >
              {{ automation.mcpUseDefaultRoot }}
            </button>
            <button
              v-if="isTauri()"
              type="button"
              class="rounded border border-border px-2 py-1 text-[10px] text-surface hover:bg-hover"
              data-test-id="settings-mcp-root-directory"
              @click="chooseRootDirectory"
            >
              {{ automation.mcpChooseRootDirectory }}
            </button>
          </div>
        </div>
        <p class="mt-1.5 text-[10px] leading-relaxed text-muted">
          {{ automation.mcpRootDirectoryDescription }}
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
          <h4 class="text-[11px] font-medium text-surface">{{ automation.mcpTools }}</h4>
          <p class="mt-0.5 text-[10px] text-muted">
            {{
              automation.mcpToolsEnabled({
                enabled: enabledToolCount,
                total: configurableMCPTools.length
              })
            }}
          </p>
        </div>
        <button
          v-if="disabledMCPTools.length"
          type="button"
          class="text-[10px] text-accent hover:underline"
          @click="enableAllTools"
        >
          {{ automation.mcpEnableAllTools }}
        </button>
      </div>

      <div class="border-b border-border p-2">
        <AppInput
          v-model="toolSearch"
          type="search"
          size="sm"
          :placeholder="common.search"
          :aria-label="automation.mcpSearchTools"
          data-test-id="settings-mcp-tool-search"
        />
      </div>

      <div class="grid grid-cols-2 gap-2 border-b border-border p-2.5">
        <div class="flex items-center justify-between gap-2 rounded bg-input px-2.5 py-2">
          <span class="text-[10px] text-surface">{{ automation.mcpReadOnlyTools }}</span>
          <AppSwitch
            :model-value="inspectionToolsStatus.enabled"
            :state="inspectionToolsStatus.state"
            :label="automation.mcpReadOnlyTools"
            data-test-id="settings-mcp-inspection-tools"
            @update:model-value="setMCPToolCategoryEnabled('read', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-2 rounded bg-input px-2.5 py-2">
          <span class="text-[10px] text-surface">{{ automation.mcpSideEffectTools }}</span>
          <AppSwitch
            :model-value="modificationToolsStatus.enabled"
            :state="modificationToolsStatus.state"
            :label="automation.mcpSideEffectTools"
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
            ? automation.mcpExternalRestartNotice
            : automation.mcpToolsRestartNotice
        }}
      </p>
    </div>

    <div>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        :disabled="mcpRuntime.status === 'starting' || mcpRuntime.externallyManaged"
        data-test-id="settings-mcp-restart"
        @click="restart"
      >
        {{
          mcpRuntime.status === 'starting' || mcpRuntime.checking
            ? automation.mcpStarting
            : mcpRuntime.externallyManaged
              ? automation.mcpExternallyManaged
              : automation.mcpRestart
        }}
      </button>
    </div>
  </section>
</template>
