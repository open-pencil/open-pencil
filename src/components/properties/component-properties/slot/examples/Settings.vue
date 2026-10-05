<script setup lang="ts">
import { ref } from 'vue'

import type { SlotDefinitionControl, SlotInstanceOption } from '@open-pencil/vue'

import PanelSection from '@/components/ui/panel/PanelSection.vue'

import SlotSettingsPopover from '../SlotSettingsPopover.vue'

const options = ref<SlotInstanceOption[]>([
  { id: 'item', name: 'List item', preferred: true, source: 'This file' },
  { id: 'divider', name: 'Divider', preferred: false, source: 'This file' },
  { id: 'button', name: 'Button', preferred: false, source: 'Design system' }
])
const slot = ref<SlotDefinitionControl>({
  id: 'items',
  name: 'Items',
  description: 'Put list items here',
  minChildren: 1,
  maxChildren: 3,
  preferredOnly: true,
  preferred: options.value.filter((option) => option.preferred)
})
const log = ref<string[]>([])
const record = (entry: string) => {
  log.value = [entry, ...log.value].slice(0, 4)
}

function setPreferred(id: string, preferred: boolean) {
  options.value = options.value.map((option) =>
    option.id === id ? { ...option, preferred } : option
  )
  slot.value = { ...slot.value, preferred: options.value.filter((option) => option.preferred) }
  record(`${preferred ? 'prefer' : 'unprefer'} ${id}`)
}
</script>

<template>
  <div class="flex gap-6">
    <div class="w-[240px] overflow-hidden rounded-lg border border-border bg-panel">
      <PanelSection label="Slots">
        <div class="flex items-center gap-1">
          <span class="flex-1 truncate text-xs text-surface">{{ slot.name }}</span>
          <SlotSettingsPopover
            :slot="slot"
            :options="options"
            @describe="record(`describe: ${$event}`)"
            @set-limits="
              record(`limits: ${$event.minChildren ?? '-'}..${$event.maxChildren ?? '-'}`)
            "
            @set-preferred-only="record(`preferred only: ${$event}`)"
            @set-preferred="setPreferred"
          />
        </div>
      </PanelSection>
    </div>
    <ul class="text-xs text-muted" aria-label="Events">
      <li v-for="entry in log" :key="entry">{{ entry }}</li>
    </ul>
  </div>
</template>
