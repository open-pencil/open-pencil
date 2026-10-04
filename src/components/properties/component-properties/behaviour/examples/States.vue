<script setup lang="ts">
import { ref } from 'vue'

import type { BehaviourControl } from '@open-pencil/vue'

import BehaviourSection from '../BehaviourSection.vue'

const stateProperty = { id: 'state', name: 'State', values: ['On', 'Off'] }
const sizeProperty = { id: 'size', name: 'Size', values: ['Small', 'Large'] }
const thumbSlot = { id: 'thumb', name: 'Thumb', values: [] }
const trackSlot = { id: 'track', name: 'Track', values: [] }
const rangeSlot = { id: 'range', name: 'Range', values: [] }

const switchComplete = ref<BehaviourControl>({
  kind: 'switch',
  missing: 0,
  values: [
    {
      id: 'value',
      type: 'boolean',
      required: true,
      propertyId: 'state',
      on: 'On',
      off: 'Off',
      options: [stateProperty, sizeProperty]
    },
    {
      id: 'disabled',
      type: 'boolean',
      required: false,
      propertyId: null,
      options: [stateProperty, sizeProperty]
    }
  ],
  parts: [{ id: 'thumb', required: false, propertyId: 'thumb', options: [thumbSlot] }]
})
const sliderIncomplete = ref<BehaviourControl>({
  kind: 'slider',
  missing: 1,
  values: [
    { id: 'value', type: 'number', min: 0, max: 100, step: 1, default: 50 },
    { id: 'disabled', type: 'boolean', required: false, propertyId: null, options: [stateProperty] }
  ],
  parts: [
    {
      id: 'track',
      required: true,
      propertyId: 'track',
      options: [trackSlot, rangeSlot, thumbSlot]
    },
    { id: 'range', required: false, propertyId: null, options: [trackSlot, rangeSlot, thumbSlot] },
    { id: 'thumb', required: true, propertyId: null, options: [trackSlot, rangeSlot, thumbSlot] }
  ]
})
const log = ref<string[]>([])
const record = (entry: string) => {
  log.value = [entry, ...log.value].slice(0, 4)
}
</script>

<template>
  <div class="flex items-start gap-6">
    <div
      v-for="(state, index) in [null, switchComplete, sliderIncomplete]"
      :key="index"
      class="w-[240px] overflow-hidden rounded-lg border border-border bg-panel"
    >
      <BehaviourSection
        :behaviour="state"
        @add="record(`add ${$event}`)"
        @remove="record('remove')"
        @bind-value="(value, property) => record(`bind ${value} → ${property}`)"
        @map-value="(value, mapping) => record(`map ${value}: ${mapping.on}/${mapping.off}`)"
        @set-number="
          (value, settings) =>
            record(`${value}: ${settings.min}..${settings.max} by ${settings.step}`)
        "
        @bind-part="(part, property) => record(`bind ${part} → ${property}`)"
      />
    </div>
    <ul class="text-xs text-muted" aria-label="Events">
      <li v-for="entry in log" :key="entry">{{ entry }}</li>
    </ul>
  </div>
</template>
