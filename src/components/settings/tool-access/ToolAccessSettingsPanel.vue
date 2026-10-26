<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue/i18n'

import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { useToolAccess } from '@/app/automation/tool-access/settings/list'
import { toolAccessCounts, useToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import type { ToolAccessEntry } from '@/app/automation/tool-access/types'
import CapabilityList from '@/components/settings/capability/CapabilityList.vue'
import CapabilityPage from '@/components/settings/capability/CapabilityPage.vue'
import { filterCapabilities } from '@/components/settings/capability/filter'
import type { CapabilityFilter, CapabilityGroup } from '@/components/settings/capability/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const automation = useAutomationMessages()
const { target, tools, disabled, selectTarget, reset } = useToolAccessSettings()
const { search, groups, expanded, setGroupEnabled, isEnabled, setToolEnabled } = useToolAccess(
  tools,
  disabled
)
const { restart } = useMCPSettings()
const show = ref<CapabilityFilter>('all')

const targetOptions = computed(() => [
  { value: 'ai', label: automation.value.builtInAI },
  { value: 'mcp', label: automation.value.localMCP }
])
function targetCount(value: string) {
  const counts = toolAccessCounts.value[value === 'mcp' ? 'mcp' : 'ai']
  return `${counts.enabled}/${counts.total}`
}

const listGroups = computed<CapabilityGroup[]>(() =>
  filterCapabilities(
    groups.value.map((group) => ({
      key: group.effect,
      label:
        group.effect === 'read' ? automation.value.readOnlyTools : automation.value.sideEffectTools,
      count: automation.value.toolsEnabled(group.counts),
      toggle: { enabled: group.enabled, state: group.state },
      items: group.tools.map((tool) => ({
        key: tool.name,
        name: tool.name,
        description: tool.description,
        enabled: isEnabled(tool)
      }))
    })),
    show.value
  )
)
const hasMatches = computed(() => listGroups.value.some((group) => group.items.length))

function effectOf(key: string): ToolAccessEntry['effect'] {
  return key === 'write' ? 'write' : 'read'
}
function setExpanded(key: string, open: boolean) {
  expanded.value = { ...expanded.value, [effectOf(key)]: open }
}
</script>

<template>
  <CapabilityPage
    v-model:search="search"
    v-model:show="show"
    :search-label="automation.searchTools"
    data-slot="tool-access"
  >
    <template #description>
      {{
        target === 'ai' ? automation.aiToolAccessDescription : automation.mcpToolAccessDescription
      }}
    </template>
    <template #tabs>
      <SegmentedControl
        :model-value="target"
        :options="targetOptions"
        :label="automation.toolAccessTarget"
        class="self-start @max-md/capability-page:w-full"
        @update:model-value="selectTarget"
      >
        <template #option="{ option }">
          <span class="truncate">{{ option.label }}</span>
          <span class="text-muted tabular-nums">{{ targetCount(option.value) }}</span>
        </template>
      </SegmentedControl>
    </template>
    <template #tools>
      <AppButton size="sm" variant="outline" @click="reset">{{
        automation.restoreToolDefaults
      }}</AppButton>
    </template>
    <AppPlaceholder
      v-if="!hasMatches"
      size="compact"
      :fill="false"
      :label="automation.noMatchingTools"
    />
    <CapabilityList
      v-else
      :groups="listGroups"
      :expanded="expanded"
      @update:expanded="setExpanded"
      @set-group="(key, enabled) => setGroupEnabled(effectOf(key), enabled)"
      @set-item="(_group, name, enabled) => setToolEnabled(name, enabled)"
    />
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="max-w-prose text-[11px] leading-relaxed text-muted">
        {{
          target === 'ai'
            ? automation.aiToolsNotice
            : mcpRuntime.externallyManaged
              ? automation.externalRestartNotice
              : automation.toolsRestartNotice
        }}
      </p>
      <AppButton
        v-if="target === 'mcp'"
        variant="outline"
        :disabled="mcpRuntime.externallyManaged"
        :loading="mcpRuntime.status === 'starting' || mcpRuntime.checking"
        @click="restart"
        >{{
          mcpRuntime.externallyManaged ? automation.externallyManaged : automation.restart
        }}</AppButton
      >
    </div>
  </CapabilityPage>
</template>
