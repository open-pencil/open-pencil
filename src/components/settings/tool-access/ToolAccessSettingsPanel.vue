<script setup lang="ts">
import { computed } from 'vue'

import { useAutomationMessages } from '@open-pencil/vue'

import { mcpRuntime } from '@/app/automation/mcp/runtime'
import { useMCPSettings } from '@/app/automation/mcp/settings/use'
import { useToolAccessSettings } from '@/app/automation/tool-access/settings/use'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'

import ToolAccessList from './ToolAccessList.vue'

const automation = useAutomationMessages()
const { target, tools, disabled, selectTarget, reset } = useToolAccessSettings()
const { restart } = useMCPSettings()
const options = computed(() => [
  { value: 'ai', label: automation.value.builtInAI },
  { value: 'mcp', label: automation.value.localMCP }
])
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-5 pb-5 sm:px-6 sm:pb-6">
    <SettingsSection class="shrink-0 pt-5 sm:pt-6">
      <template #title>{{ automation.toolAccess }}</template>
      <template #description>{{ automation.toolAccessDescription }}</template>
      <SegmentedControl
        :model-value="target"
        :options="options"
        :label="automation.toolAccessTarget"
        @update:model-value="selectTarget"
      />
      <p class="text-xs leading-relaxed text-muted">
        {{
          target === 'ai' ? automation.aiToolAccessDescription : automation.mcpToolAccessDescription
        }}
      </p>
      <p class="text-xs leading-relaxed text-muted">
        {{
          target === 'ai'
            ? automation.aiToolsNotice
            : mcpRuntime.externallyManaged
              ? automation.externalRestartNotice
              : automation.toolsRestartNotice
        }}
      </p>
      <div v-if="target === 'mcp'">
        <AppButton
          :disabled="mcpRuntime.externallyManaged"
          :loading="mcpRuntime.status === 'starting' || mcpRuntime.checking"
          @click="restart"
          >{{
            mcpRuntime.externallyManaged ? automation.externallyManaged : automation.restart
          }}</AppButton
        >
      </div>
    </SettingsSection>
    <ToolAccessList v-model:disabled-tools="disabled" :tools="tools" @reset="reset" />
  </div>
</template>
