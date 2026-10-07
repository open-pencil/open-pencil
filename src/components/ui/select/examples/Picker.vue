<script setup lang="ts">
import { ref } from 'vue'
import IconComponent from '~icons/lucide/component'
import IconDiamond from '~icons/lucide/diamond'
import IconPlus from '~icons/lucide/plus'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

const components: AppPickerItem[] = [
  { value: 'item', label: 'List item', description: 'This file', group: 'Preferred' },
  {
    value: 'item-icon',
    label: 'List item / With icon',
    description: 'This file',
    group: 'Preferred'
  },
  { value: 'divider', label: 'Divider', description: 'This file', group: 'All components' },
  { value: 'button', label: 'Button', description: 'Design system', group: 'All components' },
  { value: 'avatar', label: 'Avatar', description: 'Design system', group: 'All components' }
]
const variables: AppPickerItem[] = [
  { value: 'space/sm', label: 'Space/sm', group: 'Spacing' },
  { value: 'space/md', label: 'Space/md', group: 'Spacing' },
  { value: 'space/lg', label: 'Space/lg', group: 'Spacing' },
  { value: 'radius/md', label: 'Radius/md', group: 'Radius', disabled: true }
]
const chosen = ref('')
</script>

<template>
  <div class="flex w-[240px] flex-col gap-2 rounded-lg border border-border bg-panel p-3">
    <div class="flex items-center justify-between text-xs text-surface">
      Components
      <AppPicker
        heading="Add instances"
        :items="components"
        search-placeholder="Search components"
        empty-label="No components found"
        close-label="Close"
        @select="chosen = $event"
      >
        <template #trigger>
          <IconButton label="Add instances"><IconPlus class="size-3.5" /></IconButton>
        </template>
        <template #leading><IconComponent class="size-3.5" /></template>
      </AppPicker>
    </div>
    <div class="flex items-center justify-between text-xs text-surface">
      Variables
      <AppPicker
        heading="Apply variable"
        :items="variables"
        density="compact"
        search-placeholder="Search variables"
        empty-label="No variables found"
        close-label="Close"
        @select="chosen = $event"
      >
        <template #trigger>
          <IconButton label="Apply variable"><IconDiamond class="size-3.5" /></IconButton>
        </template>
        <template #leading><IconDiamond class="size-3.5 text-component" /></template>
        <template #footer="{ close }">
          <AppButton class="w-full justify-start" @click="close()">
            <IconPlus class="size-3.5" /> Create number variable
          </AppButton>
        </template>
      </AppPicker>
    </div>
    <p class="text-[11px] text-muted">Chosen: {{ chosen || '—' }}</p>
  </div>
</template>
