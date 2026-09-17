<script setup lang="ts">
import { computed } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { useToolAccess } from '@/app/automation/tool-access/settings/list'
import { useToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import type { ToolAccessGroup } from '@/app/automation/tool-access/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import { AppDialogBody } from '@/components/ui/dialog'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

import ToolAccessList from './ToolAccessList.vue'

const automation = useAutomationMessages()
const { target, tools, disabled, selectTarget, reset } = useToolAccessSettings()
const { search, enabledCount, groups, expanded, setGroupEnabled, isEnabled, setToolEnabled } =
  useToolAccess(tools, disabled)
const { restart } = useMCPSettings()

const targetOptions = computed(() => [
  { value: 'ai', label: automation.value.builtInAI },
  { value: 'mcp', label: automation.value.localMCP }
])
const labelledGroups = computed<ToolAccessGroup[]>(() =>
  groups.value.map((group) => ({
    ...group,
    label:
      group.effect === 'read' ? automation.value.readOnlyTools : automation.value.sideEffectTools
  }))
)
const hasMatches = computed(() => labelledGroups.value.some((group) => group.tools.length))
function setExpanded(effect: 'read' | 'write', open: boolean) {
  expanded.value = { ...expanded.value, [effect]: open }
}
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-slot="tool-access">
    <div
      class="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-3 sm:px-6"
      data-slot="tool-access-toolbar"
    >
      <SegmentedControl
        :model-value="target"
        :options="targetOptions"
        :label="automation.toolAccessTarget"
        class="max-sm:w-full"
        @update:model-value="selectTarget"
      />
      <span class="text-xs text-muted">
        {{ automation.toolsEnabled({ enabled: enabledCount, total: tools.length }) }}
      </span>
      <AppButton size="xs" variant="link" @click="reset">{{
        automation.restoreToolDefaults
      }}</AppButton>
      <AppInput
        v-model="search"
        type="search"
        class="ml-auto min-w-40 flex-1 sm:max-w-60"
        :placeholder="automation.searchTools"
        :aria-label="automation.searchTools"
      />
    </div>
    <AppDialogBody :ui="{ body: 'p-5 sm:p-6' }">
      <p class="pb-3 text-xs leading-relaxed text-muted">
        {{
          target === 'ai' ? automation.aiToolAccessDescription : automation.mcpToolAccessDescription
        }}
      </p>
      <AppPlaceholder v-if="!hasMatches" :label="automation.noMatchingTools" />
      <ToolAccessList
        v-else
        :groups="labelledGroups"
        :expanded="expanded"
        :is-enabled="isEnabled"
        @update:expanded="setExpanded"
        @set-group="setGroupEnabled"
        @set-tool="setToolEnabled"
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
    </AppDialogBody>
  </div>
</template>
