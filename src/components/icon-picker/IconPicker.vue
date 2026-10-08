<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { iconNames } from '@open-pencil/scene-graph'
import { useCommonMessages, useIconSearch, usePanelMessages } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { lastIconSet, recentIcons, rememberIcon } from '@/app/editor/icon-picker/history'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'
import type { AppComboboxOption } from '@/components/ui/select/AppCombobox.vue'
import AppPicker from '@/components/ui/select/AppPicker.vue'
import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'

import IconPreview from './IconPreview.vue'

const {
  heading,
  selected,
  set: initialSet,
  tooltip,
  side = 'left',
  align = 'start'
} = defineProps<{
  heading: string
  /** The icon shown now, marked in the grid. */
  selected?: string
  /** The set to open on, by prefix, such as the swapped icon's own; the last one chosen if unset. */
  set?: string
  tooltip?: string
  side?: 'left' | 'right' | 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
}>()
const emit = defineEmits<{ select: [name: string] }>()

/** The set selector's value for every set; Reka reserves the empty string, and no prefix has `*`. */
const ALL_SETS = '*'
const open = defineModel<boolean>('open', { default: false })

const store = useEditorStore()
const panels = usePanelMessages()
const common = useCommonMessages()
const search = useIconSearch()
const { query, visible, hasMore, loadMore, loading, failed, previews } = search

/** The icons placed in the document, read when the picker opens. */
const placed = ref<string[]>([])
watch(open, (isOpen) => {
  if (!isOpen) return
  void search.loadSets()
  search.set.value = initialSet ?? (lastIconSet.value || null)
  placed.value = iconNames(store.graph.getAllNodes())
  search.want([...placed.value, ...recentIcons.value])
})

const setOptions = computed<AppComboboxOption[]>(() => [
  { value: ALL_SETS, label: panels.value.allIconSets },
  ...search.sets.value.map((info) => ({
    value: info.prefix,
    label: info.name,
    description: info.license ?? undefined,
    meta: panels.value.iconSetCount(info.total)
  }))
])
const chosenSet = computed({
  get: () => search.set.value ?? ALL_SETS,
  set: (value: string) => {
    const prefix = value === ALL_SETS ? null : value
    search.set.value = prefix
    lastIconSet.value = prefix ?? ''
  }
})

function item(name: string, group?: string): AppPickerItem {
  return {
    value: name,
    label: name.slice(name.indexOf(':') + 1),
    description: search.setName(name),
    group
  }
}
/**
 * Before a query, the icons placed in the file and picked lately come first, from the chosen
 * set only, and then the rest of that set. A query shows only what it finds.
 */
const items = computed<AppPickerItem[]>(() => {
  if (query.value.trim()) return visible.value.map((name) => item(name))
  const prefix = search.set.value
  const inSet = (name: string) => !prefix || name.startsWith(`${prefix}:`)
  const inFile = placed.value.filter(inSet)
  const recent = recentIcons.value.filter((name) => inSet(name) && !inFile.includes(name))
  const shown = new Set([...inFile, ...recent])
  const setLabel = prefix ? search.setName(`${prefix}:`) : undefined
  return [
    ...inFile.map((name) => item(name, panels.value.iconsInFile)),
    ...recent.map((name) => item(name, panels.value.recentIcons)),
    ...visible.value.filter((name) => !shown.has(name)).map((name) => item(name, setLabel))
  ]
})
// A search over every set lists each icon with its set; anything narrower is browsed by sight.
const layout = computed(() => (query.value.trim() && !search.set.value ? 'list' : 'grid'))

const emptyLabel = computed(() => {
  if (failed.value) return panels.value.iconSearchFailed
  if (loading.value) return panels.value.searchingIcons
  return query.value.trim() || search.set.value
    ? panels.value.noIconsFound
    : panels.value.iconSearchHint
})

function pick(name: string) {
  rememberIcon(name)
  emit('select', name)
}
</script>

<template>
  <AppPicker
    v-model:open="open"
    v-model:query="query"
    search="remote"
    :layout="layout"
    :has-more="hasMore"
    :heading="heading"
    :items="items"
    :selected="selected"
    :tooltip="tooltip"
    :side="side"
    :align="align"
    :search-placeholder="panels.searchIcons"
    :empty-label="emptyLabel"
    :close-label="common.close"
    @select="pick"
    @load-more="loadMore"
  >
    <template #trigger>
      <slot name="trigger" />
    </template>
    <template #filters>
      <AppCombobox
        v-model="chosenSet"
        :options="setOptions"
        :label="panels.iconSet"
        :search-placeholder="panels.searchIconSets"
        :empty-label="panels.noIconSetsFound"
        :result-limit="setOptions.length"
      />
    </template>
    <template #leading="{ item: entry }">
      <IconPreview :svg="previews.get(entry.value)" class="size-5 text-surface" />
    </template>
    <template v-if="layout === 'grid' && items.length > 0" #footer="{ highlighted }">
      <p class="flex h-5 items-center gap-1 truncate px-1 text-[11px]">
        <template v-if="highlighted">
          <span class="truncate text-surface">{{ highlighted.label }}</span>
          <span class="truncate text-muted">{{ highlighted.description }}</span>
        </template>
      </p>
    </template>
  </AppPicker>
</template>
