<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import {
  configurableMCPTools,
  disabledMCPTools,
  setMCPToolEnabled
} from '@/app/automation/mcp/preferences'
import { mcpRuntime, refreshMCPRuntime, restartMCPRuntime } from '@/app/automation/mcp/runtime'
import { getAutomationAuthToken } from '@/app/automation/mcp/spawn'
import AppSwitch from '@/components/ui/AppSwitch.vue'

const { dialogs } = useI18n()
const toolSearch = ref('')
const copyError = ref<string | null>(null)
const mcpEndpoint = computed(() => `http://127.0.0.1:${mcpRuntime.port}/mcp`)
const { copy: copyEndpoint, copied: endpointCopied } = useClipboard({ copiedDuring: 2000 })
const { copy: copyToken, copied: tokenCopied } = useClipboard({ copiedDuring: 2000 })
const { copy: copyConfig, copied: configCopied } = useClipboard({ copiedDuring: 2000 })
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

function restart() {
  void restartMCPRuntime()
}

function isToolEnabled(name: string): boolean {
  return !disabledToolNames.value.has(name)
}

function enableAllTools(): void {
  disabledMCPTools.value = []
}

async function copyClientConfig(): Promise<void> {
  copyError.value = null
  try {
    const token = await getAutomationAuthToken()
    const config = {
      mcpServers: {
        'open-pencil': {
          url: mcpEndpoint.value,
          ...(token
            ? {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              }
            : {})
        }
      }
    }
    await copyConfig(JSON.stringify(config, null, 2))
  } catch (error) {
    copyError.value = error instanceof Error ? error.message : String(error)
  }
}

async function copyAccessToken(): Promise<void> {
  copyError.value = null
  try {
    const token = await getAutomationAuthToken()
    if (!token) throw new Error(dialogs.value.mcpAccessTokenUnavailable)
    await copyToken(token)
  } catch (error) {
    copyError.value = error instanceof Error ? error.message : String(error)
  }
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
        <dd class="flex min-w-0 items-center gap-2 text-surface">
          <code class="min-w-0 flex-1 select-all break-all text-[10px]">{{ mcpEndpoint }}</code>
          <button
            type="button"
            class="shrink-0 rounded p-1 text-muted hover:bg-hover hover:text-surface"
            :aria-label="dialogs.mcpCopyEndpoint"
            data-test-id="settings-mcp-copy-endpoint"
            @click="copyEndpoint(mcpEndpoint)"
          >
            <icon-lucide-check v-if="endpointCopied" class="size-3 text-green-500" />
            <icon-lucide-copy v-else class="size-3" />
          </button>
        </dd>
        <dt class="text-muted">{{ dialogs.mcpAuthentication }}</dt>
        <dd class="text-surface">
          {{ mcpRuntime.authRequired ? dialogs.mcpBearerTokenAuth : dialogs.mcpNoAuthentication }}
        </dd>
        <template v-if="mcpRuntime.version">
          <dt class="text-muted">{{ dialogs.mcpVersion }}</dt>
          <dd class="font-mono text-surface">{{ mcpRuntime.version }}</dd>
        </template>
      </dl>

      <div class="mt-3 border-t border-border pt-3">
        <div class="flex items-start justify-between gap-3">
          <p class="max-w-sm text-[10px] leading-relaxed text-muted">
            {{ dialogs.mcpClientConfigDescription }}
          </p>
          <div class="flex shrink-0 items-center gap-1.5">
            <button
              v-if="mcpRuntime.authRequired"
              type="button"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-surface hover:bg-hover"
              data-test-id="settings-mcp-copy-token"
              @click="copyAccessToken"
            >
              <icon-lucide-check v-if="tokenCopied" class="size-3 text-green-500" />
              <icon-lucide-copy v-else class="size-3" />
              {{ tokenCopied ? dialogs.copied : dialogs.mcpCopyAccessToken }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] text-surface hover:bg-hover"
              data-test-id="settings-mcp-copy-config"
              @click="copyClientConfig"
            >
              <icon-lucide-check v-if="configCopied" class="size-3 text-green-500" />
              <icon-lucide-copy v-else class="size-3" />
              {{ configCopied ? dialogs.copied : dialogs.mcpCopyClientConfig }}
            </button>
          </div>
        </div>
        <p v-if="copyError" class="mt-2 text-[10px] text-red-400">{{ copyError }}</p>
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
        <input
          v-model="toolSearch"
          type="search"
          :placeholder="dialogs.search"
          :aria-label="dialogs.mcpSearchTools"
          class="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-[11px] text-surface outline-none placeholder:text-muted focus:border-accent"
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
