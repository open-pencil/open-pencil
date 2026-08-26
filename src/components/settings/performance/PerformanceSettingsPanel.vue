<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from '@open-pencil/vue'
import {
  getFigPopulationWorkerStatus,
  type FigPopulationWorkerStatus
} from '@open-pencil/core/kiwi'

import { figPopulationWorkersEnabled } from '@/app/settings/performance'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'

const { dialogs } = useI18n()
const status = ref<FigPopulationWorkerStatus>(getFigPopulationWorkerStatus())
const formattedLimit = computed(() => new Intl.NumberFormat().format(status.value.maxGraphNodes))

useIntervalFn(() => {
  status.value = getFigPopulationWorkerStatus()
}, 500)
</script>

<template>
  <section class="flex flex-col gap-4" data-test-id="settings-performance-panel">
    <div>
      <h3 class="text-xs font-semibold text-surface">{{ dialogs.settingsPerformance }}</h3>
      <p class="mt-1 text-[11px] leading-relaxed text-muted">
        {{ dialogs.performanceDescription }}
      </p>
    </div>

    <div class="rounded-lg border border-border bg-panel p-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-[11px] font-medium text-surface">
            {{ dialogs.figPopulationWorkers }}
          </p>
          <p class="mt-1 max-w-md text-[10px] leading-relaxed text-muted">
            {{ dialogs.figPopulationWorkersDescription }}
          </p>
        </div>
        <AppSwitch
          v-if="status.available"
          v-model="figPopulationWorkersEnabled"
          :label="dialogs.figPopulationWorkers"
          data-test-id="settings-fig-population-workers"
        />
        <AppBadge v-else>{{ dialogs.developmentOnly }}</AppBadge>
      </div>

      <div class="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3">
        <div class="rounded bg-hover px-2.5 py-2">
          <p class="text-[9px] uppercase tracking-wide text-muted">
            {{ dialogs.activeWorkers }}
          </p>
          <p class="mt-0.5 text-sm font-semibold text-surface" data-test-id="active-worker-count">
            {{ status.activeCount }}
          </p>
        </div>
        <div class="rounded bg-hover px-2.5 py-2">
          <p class="text-[9px] uppercase tracking-wide text-muted">
            {{ dialogs.workerNodeLimit }}
          </p>
          <p class="mt-0.5 text-sm font-semibold text-surface">{{ formattedLimit }}</p>
        </div>
      </div>
    </div>

    <div
      class="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3"
    >
      <p class="text-[11px] font-medium text-surface">{{ dialogs.workerMemoryWarning }}</p>
      <p class="mt-1 text-[10px] leading-relaxed text-muted">
        {{ dialogs.workerMemoryWarningDescription }}
      </p>
    </div>

    <p class="text-[10px] leading-relaxed text-muted">
      {{ dialogs.workerReopenNotice }}
    </p>
  </section>
</template>
