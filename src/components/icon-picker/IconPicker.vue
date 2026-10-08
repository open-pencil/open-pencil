<script setup lang="ts">
import { compact } from 'es-toolkit'
import { computed, ref, watch } from 'vue'

import { iconNames } from '@open-pencil/scene-graph'
import { useCommonMessages, useIconSearch, usePanelMessages } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { lastIconSet, recentIcons, rememberIcon } from '@/app/editor/icon-picker/history'
import { formatNumber } from '@/app/i18n/number'
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
const { query, visible, hasMore, loadMore, loading, failed, previews, setsLoading } = search

/** The set restored from the last visit, as opposed to one the caller asked for. */
let remembered: string | null = null
// A remembered set that no longer loads, such as one the source has since dropped, gives way
// to every set rather than leaving each later visit failed. A set the caller asked for stays.
watch(failed, (isFailed) => {
  if (!isFailed || !remembered || query.value.trim() || search.set.value !== remembered) return
  remembered = null
  lastIconSet.value = ''
  search.set.value = null
})

/** The icons placed in the document, read when the picker opens. */
const placed = ref<string[]>([])
watch(open, (isOpen) => {
  if (!isOpen) return
  void search.loadSets()
  remembered = initialSet ? null : lastIconSet.value || null
  search.set.value = initialSet ?? remembered
  placed.value = iconNames(store.graph.getAllNodes())
  search.want([...placed.value, ...recentIcons.value])
})

/** Sets by prefix, for their names and licenses in the footer. */
const setsByPrefix = computed(() => new Map(search.sets.value.map((info) => [info.prefix, info])))
const setOptions = computed<AppComboboxOption[]>(() => [
  { value: ALL_SETS, label: panels.value.allIconSets },
  ...search.sets.value.map((info) => ({
    value: info.prefix,
    label: info.name,
    meta: formatNumber(info.total),
    group: info.category ?? panels.value.otherIconSets
  }))
])
const chosenSet = computed({
  get: () => search.set.value ?? ALL_SETS,
  set: (value: string) => {
    const prefix = value === ALL_SETS ? null : value
    // A set chosen here is the person's choice, which a failed load does not undo.
    remembered = null
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
 * set only, and then the rest of that set. A query shows only what it finds. Groups are named
 * only when there are several.
 */
const items = computed<AppPickerItem[]>(() => {
  if (query.value.trim()) return visible.value.map((name) => item(name))
  const prefix = search.set.value
  const inSet = (name: string) => !prefix || name.startsWith(`${prefix}:`)
  const inFile = placed.value.filter(inSet)
  const recent = recentIcons.value.filter((name) => inSet(name) && !inFile.includes(name))
  const shown = new Set([...inFile, ...recent])
  const rest = visible.value.filter((name) => !shown.has(name))
  const named = [inFile, recent, rest].filter((group) => group.length > 0).length > 1
  const setLabel = named && prefix ? search.setName(`${prefix}:`) : undefined
  return [
    ...inFile.map((name) => item(name, panels.value.iconsInFile)),
    ...recent.map((name) => item(name, panels.value.recentIcons)),
    ...rest.map((name) => item(name, setLabel))
  ]
})

/** What the footer says with nothing highlighted: the results, the set, or how to start. */
const summary = computed(() => {
  if (query.value.trim()) {
    if (loading.value) return ''
    const count = search.found.value
    return search.capped.value
      ? panels.value.iconResultCountCapped({ count })
      : panels.value.iconResultCount(count)
  }
  const info = search.set.value ? setsByPrefix.value.get(search.set.value) : undefined
  if (info) return compact([info.name, info.license, formatNumber(info.total)]).join(' · ')
  return panels.value.iconSearchHint
})
/** The set and license of a highlighted icon. */
function details(name: string) {
  const info = setsByPrefix.value.get(name.slice(0, name.indexOf(':')))
  return compact([search.setName(name), info?.license]).join(' · ')
}

const emptyLabel = computed(() => {
  if (failed.value) return panels.value.iconSearchFailed
  // Typing searches; choosing a set loads it.
  if (loading.value)
    return query.value.trim() ? panels.value.searchingIcons : panels.value.loadingIcons
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
    layout="grid"
    :has-more="hasMore"
    :loading="loading"
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
    <template #search-trailing>
      <AppCombobox
        v-model="chosenSet"
        :options="setOptions"
        :label="panels.iconSet"
        :search-placeholder="panels.searchIconSets"
        :empty-label="setsLoading ? panels.loadingIconSets : panels.noIconSetsFound"
        :result-limit="setOptions.length"
        align="end"
        :ui="{
          trigger:
            'mr-1 h-5 w-auto max-w-32 shrink-0 border-0 bg-transparent px-1.5 hover:bg-hover',
          value: 'text-muted',
          content: 'w-64'
        }"
      >
        <template #option="{ option }">
          <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
          <span class="shrink-0 text-muted tabular-nums">{{ option.meta }}</span>
        </template>
      </AppCombobox>
    </template>
    <template #leading="{ item: entry }">
      <IconPreview :svg="previews.get(entry.value)" class="size-5 text-surface" />
    </template>
    <template v-if="items.length > 0" #footer="{ highlighted }">
      <p class="flex h-5 items-center gap-1.5 truncate px-1 text-[11px] text-muted">
        <template v-if="highlighted">
          <span class="truncate text-surface">{{ highlighted.label }}</span>
          <span class="truncate">{{ details(highlighted.value) }}</span>
        </template>
        <span v-else class="truncate">{{ summary }}</span>
      </p>
    </template>
  </AppPicker>
</template>
