<script setup lang="ts">
import { computed } from 'vue'

import { useCommonMessages, useIconSearch, usePanelMessages } from '@open-pencil/vue'

import AppPicker from '@/components/ui/select/AppPicker.vue'
import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'

import IconPreview from './IconPreview.vue'

const {
  heading,
  selected,
  tooltip,
  side = 'left',
  align = 'start'
} = defineProps<{
  heading: string
  /** The icon shown now, marked with a check. */
  selected?: string
  tooltip?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
}>()
const emit = defineEmits<{ select: [name: string] }>()
const open = defineModel<boolean>('open', { default: false })

const panels = usePanelMessages()
const common = useCommonMessages()
const { query, hits, loading, failed, previews } = useIconSearch()

const items = computed<AppPickerItem[]>(() =>
  hits.value.map(({ name, collection }) => ({
    value: name,
    label: name.slice(name.indexOf(':') + 1),
    description: collection
  }))
)

const emptyLabel = computed(() => {
  if (failed.value) return panels.value.iconSearchFailed
  if (loading.value) return panels.value.searchingIcons
  return query.value.trim() ? panels.value.noIconsFound : panels.value.iconSearchHint
})
</script>

<template>
  <AppPicker
    v-model:open="open"
    v-model:query="query"
    search="remote"
    :heading="heading"
    :items="items"
    :selected="selected"
    :tooltip="tooltip"
    :side="side"
    :align="align"
    :search-placeholder="panels.searchIcons"
    :empty-label="emptyLabel"
    :close-label="common.close"
    @select="emit('select', $event)"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
    <template #leading="{ item }">
      <IconPreview :svg="previews.get(item.value)" class="size-5 text-surface" />
    </template>
  </AppPicker>
</template>
