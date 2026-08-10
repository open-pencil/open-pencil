<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { mcpRuntime, refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'

const { dialogs } = useI18n()

onMounted(() => {
  void refreshMCPRuntime()
})

function restart() {
  void restartMCPRuntime()
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-mcp-panel">
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
        <dd class="font-mono text-surface">http://127.0.0.1:{{ mcpRuntime.port }}</dd>
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

    <div>
      <button
        type="button"
        class="rounded bg-accent px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
        :disabled="mcpRuntime.status === 'starting'"
        data-test-id="settings-mcp-restart"
        @click="restart"
      >
        {{ mcpRuntime.status === 'starting' ? dialogs.mcpStarting : dialogs.mcpRestart }}
      </button>
    </div>
  </section>
</template>
