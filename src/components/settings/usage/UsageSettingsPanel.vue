<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'

import { diagnostics } from '@/app/diagnostics'
import { isUsageEnabled } from '@/app/diagnostics/settings'
import { summarizeUsage, type UsageSummary } from '@/app/usage'

const { diagnostics: diagnosticMessages, settings } = useI18n()
const summary = ref<UsageSummary>(summarizeUsage([]))

async function refresh() {
  summary.value = summarizeUsage(await diagnostics.list())
}

onMounted(() => {
  if (!isUsageEnabled()) return
  void refresh()
})

const unsubscribe = diagnostics.subscribe(() => {
  if (isUsageEnabled()) void refresh()
  else summary.value = summarizeUsage([])
})

onUnmounted(unsubscribe)

function formatTokenValue(value: number | null): string {
  return value === null ? diagnosticMessages.value.usageNotReported : value.toLocaleString()
}
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-usage-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ settings.usage }}</h3>
      <p class="mt-1 text-[11px] text-muted">{{ diagnosticMessages.usageDescription }}</p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div class="rounded border border-border p-3">
        <div class="text-[10px] text-muted">{{ diagnosticMessages.usageRequests }}</div>
        <div class="mt-1 text-sm font-semibold text-surface">{{ summary.requests }}</div>
      </div>
      <div class="rounded border border-border p-3">
        <div class="text-[10px] text-muted">{{ diagnosticMessages.usageCompleted }}</div>
        <div class="mt-1 text-sm font-semibold text-surface">{{ summary.completedRequests }}</div>
      </div>
      <div class="rounded border border-border p-3">
        <div class="text-[10px] text-muted">{{ diagnosticMessages.usageInputTokens }}</div>
        <div class="mt-1 text-sm font-semibold text-surface">
          {{ formatTokenValue(summary.inputTokens) }}
        </div>
      </div>
      <div class="rounded border border-border p-3">
        <div class="text-[10px] text-muted">{{ diagnosticMessages.usageOutputTokens }}</div>
        <div class="mt-1 text-sm font-semibold text-surface">
          {{ formatTokenValue(summary.outputTokens) }}
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <h4 class="text-xs font-semibold text-surface">{{ diagnosticMessages.usageByModel }}</h4>
      <div v-if="summary.models.length === 0" class="text-[11px] text-muted">
        {{ diagnosticMessages.usageNoData }}
      </div>
      <div
        v-for="model in summary.models"
        :key="`${model.provider}-${model.model}`"
        class="flex justify-between text-[11px]"
      >
        <span class="text-muted">{{ model.provider }} · {{ model.model }}</span>
        <span class="text-surface">{{ model.requests }}</span>
      </div>
    </div>

    <p class="text-[10px] text-muted">{{ diagnosticMessages.usageCacheNote }}</p>
  </section>
</template>
