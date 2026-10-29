<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import { formatDay } from '@/app/metrics/format'
import { METRICS_RANGE_PRESETS, presetRange, rangeLabel } from '@/app/metrics/range'
import type { MetricsRange, MetricsRangePreset } from '@/app/metrics/range'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppRangeCalendar from '@/components/ui/date/AppRangeCalendar.vue'
import type { DayRange } from '@/components/ui/date/range'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import { metricsRangePickerTheme } from '@/theme/metrics/dashboard'

const metricsRangePicker = tv(metricsRangePickerTheme)

/**
 * Which days the whole dashboard shows: presets as rows, a calendar for any other span. Days
 * before anything was recorded can't be picked.
 */
const { today, earliest } = defineProps<{ today: string; earliest: string }>()
const range = defineModel<MetricsRange>({ required: true })

const open = ref(false)
const ui = metricsRangePicker()
const popover = usePopoverUI({ content: 'p-0' })

const label = computed(() => rangeLabel(range.value))
const span = computed(() =>
  range.value.start === range.value.end
    ? formatDay(range.value.start)
    : `${formatDay(range.value.start)} – ${formatDay(range.value.end)}`
)
const days = computed<DayRange | null>({
  get: () => ({ start: range.value.start, end: range.value.end }),
  set: (picked) => {
    if (!picked) return
    range.value = { preset: 'custom', ...picked }
    open.value = false
  }
})

function choose(preset: Exclude<MetricsRangePreset, 'custom'>) {
  range.value = presetRange(preset, today, earliest)
  open.value = false
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <AppButton variant="outline" size="sm">
        <icon-lucide-calendar class="size-3.5" />
        <span>{{ label }}</span>
        <span v-if="range.preset !== 'custom'" :class="ui.triggerSpan()">{{ span }}</span>
        <icon-lucide-chevron-down class="size-3 text-muted" />
      </AppButton>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent :class="popover.content" align="end" :side-offset="6">
        <div :class="ui.body()">
          <ul :class="ui.presets()" aria-label="Date range">
            <li v-for="preset in METRICS_RANGE_PRESETS" :key="preset.value">
              <button
                type="button"
                :class="ui.preset()"
                :data-selected="range.preset === preset.value"
                @click="choose(preset.value)"
              >
                <span>{{ preset.label }}</span>
                <icon-lucide-check v-if="range.preset === preset.value" class="size-3.5" />
              </button>
            </li>
          </ul>
          <div :class="ui.calendar()">
            <AppRangeCalendar v-model="days" label="Custom range" :min="earliest" :max="today" />
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
