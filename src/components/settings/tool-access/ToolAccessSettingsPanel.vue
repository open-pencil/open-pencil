<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue/i18n'

import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { useToolAccess } from '@/app/automation/tool-access/settings/list'
import { useToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import type { ToolAccessEntry, ToolAccessTarget } from '@/app/automation/tool-access/types'
import { toolUsage, toolUseCount } from '@/app/automation/tool-access/usage'
import CapabilityList from '@/components/settings/capability/CapabilityList.vue'
import CapabilityPage from '@/components/settings/capability/CapabilityPage.vue'
import { filterCapabilities } from '@/components/settings/capability/filter'
import type { CapabilityFilter, CapabilityGroup } from '@/components/settings/capability/types'
import SettingsResetButton from '@/components/settings/layout/SettingsResetButton.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

/**
 * The tools one kind of agent can call: the built-in AI's on Tool access, the local MCP server's
 * on the MCP page.
 */
const { target } = defineProps<{ target: ToolAccessTarget }>()

const automation = useAutomationMessages()
const { tools, disabled, modified, reset } = useToolAccessSettings(target)
const { search, sort, groups, expanded, setGroupEnabled, isEnabled, setToolEnabled } =
  useToolAccess(tools, disabled, target === 'ai' ? 'name' : 'default')
const { restart } = useMCPSettings()
const show = ref<CapabilityFilter>('all')
const sortOptions = computed(() => [
  { value: 'name' as const, label: automation.value.toolSortName },
  { value: 'most-used' as const, label: automation.value.toolSortMostUsed },
  { value: 'least-used' as const, label: automation.value.toolSortLeastUsed }
])
const usageNotice = computed(() => {
  const since = toolUsage.value.startedAt
  return since
    ? automation.value.toolUsageSince({ date: new Date(since).toLocaleDateString() })
    : automation.value.toolUsageEmpty
})

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
        usage:
          target === 'ai'
            ? automation.value.toolUsageCount({ count: toolUseCount(tool.name) })
            : undefined,
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
    :data-target="target"
  >
    <template #description>{{
      target === 'ai' ? automation.aiToolAccessDescription : automation.mcpToolAccessDescription
    }}</template>
    <template #tools>
      <AppSelect
        v-if="target === 'ai'"
        v-model="sort"
        :options="sortOptions"
        :label="automation.toolSort"
        size="sm"
        :ui="{ trigger: 'w-auto' }"
      />
      <SettingsResetButton v-if="modified" @reset="reset" />
    </template>
    <p v-if="target === 'ai'" class="text-2xs leading-relaxed text-muted">{{ usageNotice }}</p>
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
      <p class="max-w-prose text-2xs leading-relaxed text-muted">
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
