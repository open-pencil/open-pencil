<script setup lang="ts">
import { computed, onUnmounted } from 'vue'

import { useSettingsMessages } from '@open-pencil/vue/i18n'

import { mcpToolAccessOpen } from '@/app/automation/tool-access/settings/use'
import { webmcpMode } from '@/app/automation/webmcp/preferences'
import { webmcpRuntime } from '@/app/automation/webmcp/runtime'
import { useSettingsFormGuard } from '@/app/settings/navigation/use'
import { isTauri } from '@/app/tauri/env'
import ToolAccessSettingsPanel from '@/components/settings/tool-access/ToolAccessSettingsPanel.vue'
import PanelDrillIn from '@/components/ui/panel/PanelDrillIn.vue'

import MCPConnectionsSection from './MCPConnectionsSection.vue'
import MCPSettingsPanel from './MCPSettingsPanel.vue'
import WebMCPSettingsPanel from './WebMCPSettingsPanel.vue'

/** The MCP page, with the local server's tool list opening over it as Tool access does for the AI. */
const settings = useSettingsMessages()

useSettingsFormGuard(
  {
    dirty: computed(() => false),
    busy: computed(() => false),
    cancel: () => {
      mcpToolAccessOpen.value = false
    },
    crumb: { parent: () => settings.value.mcp, title: () => settings.value.toolAccess }
  },
  mcpToolAccessOpen
)
onUnmounted(() => {
  mcpToolAccessOpen.value = false
})
</script>

<template>
  <PanelDrillIn :open="mcpToolAccessOpen">
    <template #detail><ToolAccessSettingsPanel target="mcp" /></template>
    <div class="flex min-h-0 min-w-0 flex-1 flex-col" data-test-id="settings-mcp-panel">
      <MCPConnectionsSection>
        <MCPSettingsPanel />
        <!-- WebMCP serves agents built into a browser; the desktop webview has neither the API nor an agent. -->
        <WebMCPSettingsPanel v-if="!isTauri()" v-model="webmcpMode" :state="webmcpRuntime" />
      </MCPConnectionsSection>
    </div>
  </PanelDrillIn>
</template>
