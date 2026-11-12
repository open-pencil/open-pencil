<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, reactive, ref } from 'vue'

import type { InboxReportStep } from '@open-pencil/feedback/contract'

import AppButton from '@/components/ui/button/AppButton.vue'
import { metricsStepsTheme } from '@/theme/metrics/dashboard'

import { beforeReport, stepLevel } from './labels'

const metricsSteps = tv(metricsStepsTheme)

/**
 * What the app recorded in the minutes before a report, oldest first, each timed against the
 * report. A step opens to what it recorded; warnings and errors can be shown alone.
 */
const { steps, receivedAt } = defineProps<{ steps: InboxReportStep[]; receivedAt: string }>()

const ui = metricsSteps()
const opened = reactive(new Set<number>())
const onlyProblems = ref(false)
const problems = computed(
  () => steps.filter((step) => step.level === 'warning' || step.level === 'error').length
)
const shown = computed(() =>
  steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => !onlyProblems.value || step.level === 'warning' || step.level === 'error')
)

function toggle(index: number) {
  if (opened.has(index)) opened.delete(index)
  else opened.add(index)
}
const formatValue = (value: string | number | boolean | null) =>
  value === null ? '—' : String(value)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <h3 :class="ui.title()">Before the report</h3>
      <AppButton
        v-if="problems > 0 && problems < steps.length"
        size="sm"
        :variant="onlyProblems ? 'outline' : 'ghost'"
        :aria-pressed="onlyProblems"
        @click="onlyProblems = !onlyProblems"
      >
        {{ problems === 1 ? '1 warning or error' : `${problems} warnings and errors` }} only
      </AppButton>
    </div>
    <ol :class="ui.root()">
      <li v-for="{ step, index } in shown" :key="index" :class="ui.step()" :data-level="step.level">
        <button
          type="button"
          :class="ui.row()"
          :disabled="!Object.keys(step.attributes).length"
          :aria-expanded="opened.has(index)"
          @click="toggle(index)"
        >
          <span :class="ui.when()">{{ beforeReport(step.timestamp, receivedAt) }}</span>
          <span :class="ui.level()" :data-level="step.level">
            <span aria-hidden="true">{{ stepLevel(step.level) }}</span>
            <span v-if="step.level" class="sr-only">{{ step.level }}</span>
          </span>
          <span :class="ui.name()">{{ step.name }}</span>
          <span v-if="step.category" :class="ui.category()">{{ step.category }}</span>
        </button>
        <dl v-if="opened.has(index)" :class="ui.attributes()">
          <template v-for="(value, key) in step.attributes" :key="key">
            <dt :class="ui.attributeKey()">{{ key }}</dt>
            <dd :class="ui.attributeValue()">{{ formatValue(value) }}</dd>
          </template>
        </dl>
      </li>
    </ol>
  </div>
</template>
