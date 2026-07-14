<script setup lang="ts">
import type { SdkComponentMeta } from '../../sdk/component-meta'

import SdkDataTable from './SdkDataTable.vue'
import SdkEventsTable from './SdkEventsTable.vue'
import SdkPropsTable from './SdkPropsTable.vue'
import SdkSlotsTable from './SdkSlotsTable.vue'

const { components } = defineProps<{
  components: SdkComponentMeta[]
}>()

const exposeColumns = [
  { key: 'name', label: 'Exposed', kind: 'code' },
  { key: 'type', label: 'Type', kind: 'chip' },
  { key: 'description', label: 'Description', kind: 'description' }
] as const
</script>

<template>
  <section v-for="component in components" :key="component.source" class="mt-8 first:mt-0">
    <h3 :id="component.name.toLowerCase()">{{ component.name }}</h3>
    <p class="text-sm text-[var(--vp-c-text-2)]">
      Generated from <code>{{ component.source }}</code>
    </p>

    <p
      v-if="
        !component.props.length &&
        !component.events.length &&
        !component.slots.length &&
        !component.exposed.length
      "
      class="text-sm text-[var(--vp-c-text-2)]"
    >
      No component-specific props, events, slots, or exposed members.
    </p>

    <template v-if="component.props.length">
      <h4>Props</h4>
      <SdkPropsTable :rows="component.props" />
    </template>

    <template v-if="component.events.length">
      <h4>Events</h4>
      <SdkEventsTable :rows="component.events" />
    </template>

    <template v-if="component.slots.length">
      <h4>Slots</h4>
      <SdkSlotsTable :rows="component.slots" />
    </template>

    <template v-if="component.exposed.length">
      <h4>Exposed</h4>
      <SdkDataTable :columns="exposeColumns" :rows="component.exposed" />
    </template>
  </section>
</template>
