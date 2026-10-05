<script setup lang="ts">
import { ref } from 'vue'

import type { BehaviourControl } from '@open-pencil/vue'

import BehaviourSection from '../BehaviourSection.vue'

const stateProperty = { id: 'state', name: 'State', values: ['On', 'Off'] }
const sizeProperty = { id: 'size', name: 'Size', values: ['Small', 'Large'] }
const interactionProperty = {
  id: 'interaction',
  name: 'Interaction',
  values: ['Default', 'Hover', 'Pressed', 'Disabled']
}
const thumbSlot = { id: 'thumb', name: 'Thumb', values: [] }
const trackSlot = { id: 'track', name: 'Track', values: [] }

const switchComplete = ref<BehaviourControl>({
  kind: 'switch',
  missing: [],
  values: [
    {
      id: 'value',
      type: 'boolean',
      required: true,
      propertyId: 'state',
      on: 'On',
      off: 'Off',
      options: [stateProperty, sizeProperty],
      creatable: true
    },
    {
      id: 'disabled',
      type: 'boolean',
      required: false,
      propertyId: null,
      options: [stateProperty, sizeProperty],
      creatable: true
    }
  ],
  parts: [
    { id: 'thumb', required: false, propertyId: 'thumb', options: [thumbSlot], creatable: false }
  ],
  states: {
    propertyId: 'interaction',
    values: { rest: 'Default', hover: 'Hover', pressed: 'Pressed', disabled: 'Disabled' },
    options: [stateProperty, sizeProperty, interactionProperty]
  }
})
const sliderIncomplete = ref<BehaviourControl>({
  kind: 'slider',
  missing: ['thumb'],
  values: [
    { id: 'value', type: 'number', min: 0, max: 100, step: 1, default: 50 },
    {
      id: 'disabled',
      type: 'boolean',
      required: false,
      propertyId: null,
      options: [stateProperty],
      creatable: false
    }
  ],
  parts: [
    { id: 'track', required: true, propertyId: 'track', options: [trackSlot], creatable: true },
    { id: 'range', required: false, propertyId: null, options: [trackSlot], creatable: true },
    { id: 'thumb', required: true, propertyId: null, options: [], creatable: true }
  ],
  states: { propertyId: null, values: {}, options: [interactionProperty] }
})
/** A plain rectangle made a component and given a Textarea behaviour: nothing to bind yet. */
const textareaBare = ref<BehaviourControl>({
  kind: 'textarea',
  missing: ['value'],
  values: [
    { id: 'value', type: 'text', required: true, propertyId: null, options: [], creatable: true },
    {
      id: 'filled',
      type: 'boolean',
      required: false,
      propertyId: null,
      options: [],
      creatable: false
    },
    {
      id: 'disabled',
      type: 'boolean',
      required: false,
      propertyId: null,
      options: [],
      creatable: false
    }
  ],
  parts: [],
  states: { propertyId: null, values: {}, options: [] }
})
const log = ref<string[]>([])
const record = (entry: string) => {
  log.value = [entry, ...log.value].slice(0, 4)
}
</script>

<template>
  <div class="flex items-start gap-6">
    <div
      v-for="(state, index) in [null, textareaBare, switchComplete, sliderIncomplete]"
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
        @bind-states="(property) => record(`states → ${property}`)"
        @map-state="(state, value) => record(`${state} → ${value || 'default'}`)"
        @create-text="(value, name) => record(`create text ${name} for ${value}`)"
        @create-variant="(value, name) => record(`create ${name} variants for ${value}`)"
        @create-part="(part, name) => record(`create ${name} slot for ${part}`)"
      />
    </div>
    <ul class="text-xs text-muted" aria-label="Events">
      <li v-for="entry in log" :key="entry">{{ entry }}</li>
    </ul>
  </div>
</template>
