<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'
import type { SlotInstanceOption } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

/**
 * Slots that allow only preferred instances list just those; otherwise every component is
 * offered, preferred ones first.
 */
const { options, preferredOnly = false } = defineProps<{
  options: SlotInstanceOption[]
  preferredOnly?: boolean
}>()
const emit = defineEmits<{ add: [id: string] }>()
defineSlots<{ thumbnail?(props: { id: string }): unknown }>()
const { panels, common } = useI18n()

const items = computed<AppPickerItem[]>(() => {
  const toItem = (option: SlotInstanceOption, group?: string): AppPickerItem => ({
    value: option.id,
    label: option.name,
    description: option.source,
    group
  })
  const preferred = options.filter((option) => option.preferred)
  if (preferredOnly) return preferred.map((option) => toItem(option))
  return [
    ...preferred.map((option) => toItem(option, panels.value.preferredInstances)),
    ...options
      .filter((option) => !option.preferred)
      .map((option) => toItem(option, panels.value.allInstances))
  ]
})
</script>

<template>
  <AppPicker
    :heading="panels.addInstances"
    :items="items"
    :search-placeholder="panels.searchInstances"
    :empty-label="panels.noInstancesFound"
    :close-label="common.close"
    @select="emit('add', $event)"
  >
    <template #trigger>
      <IconButton :label="panels.addInstances" data-property="slot-add-instances">
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>
    <template #leading="{ item }">
      <slot name="thumbnail" :id="item.value">
        <icon-lucide-component class="size-3.5" />
      </slot>
    </template>
  </AppPicker>
</template>
