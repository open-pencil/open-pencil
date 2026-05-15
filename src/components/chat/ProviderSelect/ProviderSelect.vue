<script setup lang="ts">
import { promiseTimeout } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import type { TestIdProps } from '@open-pencil/vue'

import AppGroupedSelect from '@/components/ui/AppGroupedSelect.vue'
import {
  ACP_AGENTS,
  AI_PROVIDERS,
  AUTOMATION_HTTP_PORT,
  IS_TAURI
} from '@open-pencil/core/constants'
import { useAIChat } from '@/app/ai/chat/use'

const { providerID, providerDef } = useAIChat()

const mcpAvailable = ref(false)

async function checkMCPHealth(retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${AUTOMATION_HTTP_PORT}/health`, {
        signal: AbortSignal.timeout(2000)
      })
      if (res.ok) {
        mcpAvailable.value = true
        return
      }
    } catch (e) {
      console.error(
        '[MCP] health check failed (attempt',
        i + 1,
        '):',
        e instanceof Error ? e.message : e
      )
      if (i < retries - 1) await promiseTimeout(delayMs)
    }
  }
}

if (IS_TAURI) {
  onMounted(() => {
    void checkMCPHealth()
  })
}

const acpAgents = computed(() => (IS_TAURI && mcpAvailable.value ? ACP_AGENTS : []))

const displayName = computed(() => {
  if (providerID.value.startsWith('acp:')) {
    const agentId = providerID.value.replace('acp:', '')
    return ACP_AGENTS.find((a) => a.id === agentId)?.name ?? providerID.value
  }
  return providerDef.value.name
})

interface ProviderSelectProps extends TestIdProps {
  ui?: {
    trigger?: string
    content?: string
    item?: string
    label?: string
    separator?: string
  }
}

const { ui, testId } = defineProps<ProviderSelectProps>()

const groups = computed(() => {
  const result: Array<{ label?: string; items: Array<{ value: string; label: string }> }> = []

  if (acpAgents.value.length) {
    result.push({
      label: 'Your agents',
      items: acpAgents.value.map((agent) => ({
        value: `acp:${agent.id}`,
        label: agent.name
      }))
    })
  }

  result.push({
    label: acpAgents.value.length ? 'API key' : undefined,
    items: AI_PROVIDERS.map((provider) => ({
      value: provider.id,
      label: provider.name
    }))
  })

  return result
})
</script>

<template>
  <AppGroupedSelect
    v-model="providerID"
    :groups="groups"
    :display-value="displayName"
    :ui="ui"
    :test-id="testId"
  />
</template>
