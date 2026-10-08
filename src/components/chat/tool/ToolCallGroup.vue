<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { toolDisplayName, type ToolCallPart } from '@/app/ai/chat/tool-calls/display'
import { toolCallState } from '@/components/chat/tool/state'
import ToolCallCard from '@/components/chat/tool/ToolCallCard.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import { chatToolTheme } from '@/theme/chat/tool'
import { collapsibleContentMotion } from '@/theme/collapsible/collapsible'

/** Runs up to this long stay expanded; longer ones fold all but the latest call. */
const INLINE_CALLS = 3

const { parts } = defineProps<{ parts: ToolCallPart[] }>()
const { ai } = useI18n()
const ui = chatToolTheme()

const earlier = computed(() => parts.slice(0, -1))
const latest = computed(() => parts.at(-1))
const failed = computed(
  () => earlier.value.filter((part) => toolCallState(part) === 'error').length
)
/** The earlier steps by name, one line that truncates; the badges carry the counts. */
const names = computed(() => earlier.value.map(toolDisplayName).join(' · '))
const label = computed(() => {
  const steps = ai.value.toolSteps({ count: earlier.value.length })
  return failed.value ? `${steps} · ${ai.value.toolStepsFailed({ count: failed.value })}` : steps
})
</script>

<template>
  <div v-if="parts.length <= INLINE_CALLS" class="space-y-1.5">
    <ToolCallCard v-for="part in parts" :key="part.toolCallId" :part="part" />
  </div>
  <div v-else class="space-y-1.5">
    <CollapsibleRoot :class="ui.group()" data-slot="chat-tool-group">
      <CollapsibleTrigger :class="ui.groupTrigger()" :aria-label="label">
        <icon-lucide-list-checks :class="ui.groupIcon()" aria-hidden="true" />
        <span :class="ui.groupNames()" aria-hidden="true">{{ names }}</span>
        <AppBadge v-if="failed" :ui="{ base: ui.groupFailed() }" aria-hidden="true">
          {{ ai.toolStepsFailed({ count: failed }) }}
        </AppBadge>
        <AppBadge aria-hidden="true">{{ earlier.length }}</AppBadge>
        <icon-lucide-chevron-down :class="ui.chevron()" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent :class="collapsibleContentMotion">
        <div :class="ui.groupItems()">
          <ToolCallCard v-for="part in earlier" :key="part.toolCallId" :part="part" />
        </div>
      </CollapsibleContent>
    </CollapsibleRoot>
    <ToolCallCard v-if="latest" :key="latest.toolCallId" :part="latest" />
  </div>
</template>
