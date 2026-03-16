<script setup lang="ts">
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'
import { computed, onMounted, ref } from 'vue'

import { selectContent, selectItem, selectTrigger } from '@/components/ui/select'
import { ACP_AGENTS, AI_PROVIDERS, AUTOMATION_HTTP_PORT, IS_TAURI } from '@open-pencil/core'
import { useAIChat } from '@/composables/use-chat'

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
    } catch {
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs))
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

const { triggerClass, itemClass, testId } = defineProps<{
  triggerClass?: string
  itemClass?: string
  testId?: string
}>()
</script>

<template>
  <SelectRoot v-model="providerID">
    <SelectTrigger
      :data-test-id="testId"
      :class="
        selectTrigger({
          class:
            triggerClass ??
            'w-full justify-between rounded border border-border bg-input px-2 py-1 text-[11px] text-surface'
        })
      "
    >
      {{ displayName }}
      <icon-lucide-chevron-down class="size-2.5 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        :class="selectContent({ radius: 'lg', padding: 'md', class: 'isolate z-[52]' })"
      >
        <SelectViewport>
          <template v-if="acpAgents.length">
            <SelectGroup>
              <SelectLabel class="px-2 py-1 text-[10px] text-muted">Your agents</SelectLabel>
              <SelectItem
                v-for="agent in acpAgents"
                :key="agent.id"
                :value="`acp:${agent.id}`"
                :class="selectItem({ class: itemClass ?? 'rounded px-2 py-1 text-[11px]' })"
              >
                <SelectItemText>{{ agent.name }}</SelectItemText>
              </SelectItem>
            </SelectGroup>
            <SelectSeparator class="mx-1 my-1 h-px bg-border" />
          </template>
          <SelectGroup>
            <SelectLabel v-if="acpAgents.length" class="px-2 py-1 text-[10px] text-muted">
              API key
            </SelectLabel>
            <SelectItem
              v-for="provider in AI_PROVIDERS"
              :key="provider.id"
              :value="provider.id"
              :class="selectItem({ class: itemClass ?? 'rounded px-2 py-1 text-[11px]' })"
            >
              <SelectItemText>{{ provider.name }}</SelectItemText>
            </SelectItem>
          </SelectGroup>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
