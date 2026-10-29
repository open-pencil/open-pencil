<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import {
  RangeCalendarCell,
  RangeCalendarCellTrigger,
  RangeCalendarGrid,
  RangeCalendarGridBody,
  RangeCalendarGridHead,
  RangeCalendarGridRow,
  RangeCalendarHeadCell,
  RangeCalendarHeader,
  RangeCalendarHeading,
  RangeCalendarNext,
  RangeCalendarPrev,
  RangeCalendarRoot
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, shallowRef, watch } from 'vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import rangeCalendarTheme from '@/theme/date/range-calendar'

import type { DayRange } from './range'

const rangeCalendar = tv(rangeCalendarTheme)

/**
 * One month for picking a span of days. The model changes only once both ends are chosen, so a
 * half-picked span never reaches the caller.
 */
const { label, min, max } = defineProps<{ label: string; min?: string; max?: string }>()
const model = defineModel<DayRange | null>({ required: true })

const ui = rangeCalendar()
const toCalendar = (range: DayRange | null): DateRange =>
  range
    ? { start: parseDate(range.start), end: parseDate(range.end) }
    : { start: undefined, end: undefined }

// Reka holds the span while it is being picked; the model only takes finished ones.
const picking = shallowRef<DateRange>(toCalendar(model.value))
watch(model, (range) => (picking.value = toCalendar(range)))

const minValue = computed(() => (min ? parseDate(min) : undefined))
const maxValue = computed(() => (max ? parseDate(max) : undefined))

function pick(range: DateRange) {
  picking.value = range
  if (range.start && range.end)
    model.value = { start: range.start.toString(), end: range.end.toString() }
}
</script>

<template>
  <RangeCalendarRoot
    v-slot="{ weekDays, grid }"
    :model-value="picking"
    :min-value="minValue"
    :max-value="maxValue"
    :calendar-label="label"
    :week-starts-on="1"
    weekday-format="short"
    fixed-weeks
    :class="ui.root()"
    @update:model-value="pick"
  >
    <RangeCalendarHeader :class="ui.header()">
      <RangeCalendarPrev as-child>
        <IconButton label="Previous month">
          <icon-lucide-chevron-left class="size-3.5" />
        </IconButton>
      </RangeCalendarPrev>
      <RangeCalendarHeading :class="ui.heading()" />
      <RangeCalendarNext as-child>
        <IconButton label="Next month">
          <icon-lucide-chevron-right class="size-3.5" />
        </IconButton>
      </RangeCalendarNext>
    </RangeCalendarHeader>
    <RangeCalendarGrid v-for="month in grid" :key="month.value.toString()" :class="ui.grid()">
      <RangeCalendarGridHead>
        <RangeCalendarGridRow>
          <RangeCalendarHeadCell v-for="day in weekDays" :key="day" :class="ui.headCell()">
            {{ day }}
          </RangeCalendarHeadCell>
        </RangeCalendarGridRow>
      </RangeCalendarGridHead>
      <RangeCalendarGridBody>
        <RangeCalendarGridRow v-for="(week, index) in month.rows" :key="index">
          <RangeCalendarCell
            v-for="day in week"
            :key="day.toString()"
            :date="day"
            :class="ui.cell()"
          >
            <RangeCalendarCellTrigger :day="day" :month="month.value" :class="ui.day()" />
          </RangeCalendarCell>
        </RangeCalendarGridRow>
      </RangeCalendarGridBody>
    </RangeCalendarGrid>
  </RangeCalendarRoot>
</template>
