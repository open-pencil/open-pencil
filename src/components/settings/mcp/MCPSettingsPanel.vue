<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import {
  configurableMCPTools,
  disabledMCPTools,
  setMCPToolEnabled
} from '@/app/automation/mcp/preferences'
import { mcpRuntime, refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'
import AppInput from '@/components/ui/AppInput.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'

const { dialogs } = useI18n()
const toolSearch = ref('')
const disabledToolNames = computed(() => new Set(disabledMCPTools.value))
const enabledToolCount = computed(
  () => configurableMCPTools.filter((tool) => !disabledToolNames.value.has(tool.name)).length
)
const visibleTools = computed(() => {
  const query = toolSearch.value.trim().toLowerCase()
  if (!query) return configurableMCPTools
  return configurableMCPTools.filter(
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
      <h3 class="text-xs font-semibold text-surface">{{ dialogs.settingsMCP }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ dialogs.mcpDescription }}</p>
    </div>

    <div class="rounded border border-border bg-panel p-3 text-[11px]">
      <dl class="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        <dt class="text-muted">{{ dialogs.mcpStatus }}</dt>
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
          {{ dialogs[`mcpStatus_${mcpRuntime.status}`] }}
        </dd>
        <dt class="text-muted">{{ dialogs.mcpPort }}</dt>
        <dd class="font-mono text-surface">{{ mcpRuntime.port }}</dd>
        <dt class="text-muted">{{ dialogs.mcpAddress }}</dt>
        <dd class="select-all font-mono text-surface">127.0.0.1</dd>
        <template v-if="mcpRuntime.version">
          <dt class="text-muted">{{ dialogs.mcpVersion }}</dt>
          <dd class="font-mono text-surface">{{ mcpRuntime.version }}</dd>
        </template>
      </dl>
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
          <h4 class="text-[11px] font-medium text-surface">{{ dialogs.mcpTools }}</h4>
          <p class="mt-0.5 text-[10px] text-muted">
            {{
              dialogs.mcpToolsEnabled({
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
          {{ dialogs.mcpEnableAllTools }}
        </button>
      </div>

      <div class="border-b border-border p-2">
        <AppInput
          v-model="toolSearch"
          type="search"
          tone="panel"
          size="sm"
          :placeholder="dialogs.search"
          :aria-label="dialogs.mcpSearchTools"
          data-test-id="settings-mcp-tool-search"
        />
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
        {{ dialogs.mcpToolsRestartNotice }}
      </p>
    </div>

    <div>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        :disabled="mcpRuntime.status === 'starting'"
        data-test-id="settings-mcp-restart"
        @click="restart"
      >
        {{
          mcpRuntime.status === 'starting' || mcpRuntime.checking
            ? dialogs.mcpStarting
            : dialogs.mcpRestart
        }}
      </button>
    </div>
  </section>
</template>
