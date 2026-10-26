<script setup lang="ts">
import { computed } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue/i18n'

import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { useToolAccess } from '@/app/automation/tool-access/settings/list'
import { useToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import type { ToolAccessEntry } from '@/app/automation/tool-access/types'
import CapabilityList from '@/components/settings/capability/CapabilityList.vue'
import CapabilityPage from '@/components/settings/capability/CapabilityPage.vue'
import type { CapabilityGroup } from '@/components/settings/capability/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const automation = useAutomationMessages()
const { target, tools, disabled, selectTarget, reset } = useToolAccessSettings()
const { search, enabledCount, groups, expanded, setGroupEnabled, isEnabled, setToolEnabled } =
  useToolAccess(tools, disabled)
const { restart } = useMCPSettings()

const targetOptions = computed(() => [
  { value: 'ai', label: automation.value.builtInAI },
  { value: 'mcp', label: automation.value.localMCP }
])
const listGroups = computed<CapabilityGroup[]>(() =>
  groups.value.map((group) => ({
    key: group.effect,
    label:
      group.effect === 'read' ? automation.value.readOnlyTools : automation.value.sideEffectTools,
    toggle: { enabled: group.enabled, state: group.state },
    items: group.tools.map((tool) => ({
      key: tool.name,
      name: tool.name,
      description: tool.description,
      enabled: isEnabled(tool)
    }))
  }))
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
    :count="automation.toolsEnabled({ enabled: enabledCount, total: tools.length })"
    :search-label="automation.searchTools"
    data-slot="tool-access"
  >
    <template #leading>
      <SegmentedControl
        :model-value="target"
        :options="targetOptions"
        :label="automation.toolAccessTarget"
        class="max-sm:w-full"
        @update:model-value="selectTarget"
      />
    </template>
    <template #actions>
      <AppButton size="xs" variant="link" @click="reset">{{
        automation.restoreToolDefaults
      }}</AppButton>
    </template>
    <p class="pb-3 text-xs leading-relaxed text-muted">
      {{
        target === 'ai' ? automation.aiToolAccessDescription : automation.mcpToolAccessDescription
      }}
    </p>
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
    <p class="border-t border-border pt-3 text-xs leading-relaxed text-muted">
      {{
        target === 'ai'
          ? automation.aiToolsNotice
          : mcpRuntime.externallyManaged
            ? automation.externalRestartNotice
            : automation.toolsRestartNotice
      }}
    </p>
    <div v-if="target === 'mcp'" class="pt-2">
      <AppButton
        color="primary"
        variant="solid"
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
