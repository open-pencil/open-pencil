<script setup lang="ts">
import { ref } from 'vue'

import type { SlotInstanceOption, SlotLimit } from '@open-pencil/vue'

import ComponentPropertyTextField from '@/components/properties/component-properties/ComponentPropertyTextField.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import SlotPropertyRow from '../SlotPropertyRow.vue'

const options: SlotInstanceOption[] = [
  { id: 'item', name: 'List item', preferred: true, source: 'This file' },
  { id: 'item-icon', name: 'List item / With icon', preferred: true, source: 'This file' },
  { id: 'divider', name: 'Divider', preferred: false, source: 'This file' },
  { id: 'button', name: 'Button', preferred: false, source: 'Design system' },
  { id: 'avatar', name: 'Avatar', preferred: false, source: 'Design system' }
]
const brokenLimits: SlotLimit[] = [
  { kind: 'minimum', count: 1, met: true },
  { kind: 'maximum', count: 3, met: false },
  { kind: 'preferred', met: false, offending: 1 }
]
const title = ref('Settings')
const log = ref<string[]>([])
const record = (entry: string) => {
  log.value = [entry, ...log.value].slice(0, 4)
}
</script>

<template>
  <div class="flex gap-6">
    <div class="w-[240px] overflow-hidden rounded-lg border border-border bg-panel">
      <PanelSection label="Component properties" :ui="{ title: 'text-component' }">
        <div class="flex flex-col gap-1.5">
          <PanelFieldGroup label="Title">
            <ComponentPropertyTextField :value="title" label="Title" @update="title = $event" />
          </PanelFieldGroup>
          <SlotPropertyRow
            name="Header"
            :modified="false"
            :item-count="2"
            :options="options"
            @add="record(`Header: add ${$event}`)"
          />
          <SlotPropertyRow
            name="Body"
            :modified="true"
            :item-count="3"
            :options="options"
            @add="record(`Body: add ${$event}`)"
            @reset="record('Body: reset')"
            @delete-contents="record('Body: delete contents')"
          />
          <SlotPropertyRow
            name="Items"
            :modified="true"
            :item-count="5"
            :limits="brokenLimits"
            :options="options"
            preferred-only
            @add="record(`Items: add ${$event}`)"
            @select-layers="record('Items: select layers')"
          />
          <SlotPropertyRow
            name="Actions"
            :modified="true"
            :item-count="1"
            :limits="[{ kind: 'maximum', count: 2, met: true }]"
            :options="options"
          />
          <SlotPropertyRow
            name="Footer"
            :modified="true"
            :item-count="0"
            :limits="[{ kind: 'minimum', count: 1, met: false }]"
            :options="options"
          />
        </div>
      </PanelSection>
    </div>
    <ol aria-label="Events" class="w-48 text-[11px] text-muted">
      <li v-for="(entry, index) in log" :key="index">{{ entry }}</li>
    </ol>
  </div>
</template>
