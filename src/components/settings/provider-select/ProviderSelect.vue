<script setup lang="ts">
import { promiseTimeout } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'

import {
  ACP_AGENTS,
  AI_PROVIDERS,
  AUTOMATION_HTTP_PORT,
  IS_TAURI,
  type AIProviderID
} from '@open-pencil/core/constants'

import AppSelect from '@/components/ui/select/AppSelect.vue'
import type { AppSelectGroup } from '@/components/ui/select/select'

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

interface ProviderSelectProps {
  allowAgents?: boolean
  ui?: {
    trigger?: string
    content?: string
    item?: string
    label?: string
    separator?: string
  }
}

const { allowAgents = true, ui } = defineProps<ProviderSelectProps>()

if (IS_TAURI) {
  onMounted(() => {
    void checkMCPHealth()
  })
}

const acpAgents = computed(() => (allowAgents && IS_TAURI && mcpAvailable.value ? ACP_AGENTS : []))

const providerID = defineModel<AIProviderID>({ required: true })
const providerDef = computed(
  () => AI_PROVIDERS.find((provider) => provider.id === providerID.value) ?? AI_PROVIDERS[0]
)

const displayName = computed(() => {
  if (providerID.value === 'harness:pi') return 'Pi'
  if (providerID.value.startsWith('acp:')) {
    const agentId = providerID.value.replace('acp:', '')
    return ACP_AGENTS.find((agent) => agent.id === agentId)?.name ?? providerID.value
  }
  return providerDef.value.name
})

const groups = computed(() => {
  const result: AppSelectGroup<string>[] = []

  if (acpAgents.value.length) {
    result.push({
      label: 'Your agents',
      options: acpAgents.value.map((agent) => ({
        value: `acp:${agent.id}`,
        label: agent.name
      }))
    })
  }

  result.push({
    label: acpAgents.value.length ? 'Providers' : undefined,
    options: [...AI_PROVIDERS]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((provider) => ({
        value: provider.id,
        label: provider.name
      }))
  })

  return result
})
</script>

<template>
  <AppSelect v-model="providerID" :groups="groups" :placeholder="displayName" :ui="ui" />
</template>
