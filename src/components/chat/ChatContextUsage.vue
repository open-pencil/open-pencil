<script setup lang="ts">
import { computed } from 'vue'

import { calculateContextUsage, formatTokenCount } from '@/app/ai/chat/context-usage'
import { designModelProfile } from '@/app/ai/models'
import { getStepUsages } from '@/app/ai/tools'
import { activeTab } from '@/app/tabs'
import Tip from '@/components/ui/Tip.vue'
import { useI18n } from '@open-pencil/vue'

const { dialogs } = useI18n()

const usage = computed(() => {
  // Track the active document so usage from the previous tab is never displayed briefly.
  void activeTab.value?.id
  return calculateContextUsage(getStepUsages(), designModelProfile.value?.contextWindowTokens)
})
const progress = computed(() => usage.value?.percentUsed ?? 0)
const tooltip = computed(() => {
  const value = usage.value
  if (!value) return ''
  const used = formatTokenCount(value.usedTokens)
  if (value.totalTokens === undefined) return dialogs.value.contextUsageUnknown({ used })
  return dialogs.value.contextUsage({
    percent: value.percentUsed ?? 0,
    leftPercent: value.percentLeft ?? 100,
    used,
    total: formatTokenCount(value.totalTokens)
  })
})
</script>

<template>
  <Tip v-if="usage" :label="tooltip">
    <button
      type="button"
      data-test-id="chat-context-usage"
      :aria-label="tooltip"
      class="relative flex size-5 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-surface"
    >
      <svg class="size-4 -rotate-90" viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          stroke-opacity="0.2"
          stroke-width="3"
        />
        <circle
          cx="10"
          cy="10"
          r="7"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          pathLength="100"
          :stroke-dasharray="`${progress} 100`"
        />
      </svg>
    </button>
  </Tip>
</template>
