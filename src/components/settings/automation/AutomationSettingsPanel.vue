<script setup lang="ts">
import { computed } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import { useAutomationSettingsNavigation } from '@/app/automation/settings/navigation'
import MCPWorkspacePanel from '@/components/settings/mcp/MCPWorkspacePanel.vue'
import ToolAccessSettingsPanel from '@/components/settings/tool-access/ToolAccessSettingsPanel.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

const automation = useAutomationMessages()
const { view, selectView } = useAutomationSettingsNavigation()
const options = computed(() => [
  { value: 'tools', label: automation.value.toolsTab },
  { value: 'connections', label: automation.value.connectionsTab }
])
</script>

<template>
  <div
    class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    data-test-id="settings-mcp-panel"
  >
    <div class="shrink-0 border-b border-border px-5 pt-4 pb-4 sm:px-6">
      <SegmentedControl
        :model-value="view"
        :options="options"
        :label="automation.viewLabel"
        @update:model-value="selectView"
      />
    </div>
    <ToolAccessSettingsPanel v-if="view === 'tools'" />
    <MCPWorkspacePanel v-else />
  </div>
</template>
