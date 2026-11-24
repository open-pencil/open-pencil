<script setup lang="ts">
import { compact } from 'es-toolkit'
import { computed, ref, watch } from 'vue'

import type { IconCollection } from '@open-pencil/core/icons'
import { iconNames } from '@open-pencil/scene-graph/icons'
import { useIconSearch } from '@open-pencil/vue/controls/icon'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { lastIconSet, recentIcons, rememberIcon } from '@/app/editor/icons/history'
import { formatNumber } from '@/app/i18n/number'
import ExternalLink from '@/components/links/ExternalLink.vue'
import AppCombobox from '@/components/ui/select/AppCombobox.vue'
import type { AppComboboxOption } from '@/components/ui/select/AppCombobox.vue'
import AppPicker from '@/components/ui/select/AppPicker.vue'
import type { AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import { SF_SYMBOLS_DOCS_URL } from '@/constants'

import IconPreview from './IconPreview.vue'

const {
  heading,
  selected,
  set: initialSet,
  tooltip,
  tooltipSide = 'top',
  side = 'left',
  align = 'start'
} = defineProps<{
  heading: string
  /** The icon shown now, marked in the grid. */
  selected?: string
  /** The set to open on, by prefix, such as the swapped icon's own; the last one chosen if unset. */
  set?: string
  tooltip?: string
  /** Where the trigger's tooltip opens. */
  tooltipSide?: 'left' | 'right' | 'top' | 'bottom'
  side?: 'left' | 'right' | 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
}>()
const emit = defineEmits<{ select: [name: string] }>()

/** The set selector's value for every set; Reka reserves the empty string, and no prefix has `*`. */
const ALL_SETS = '*'
const open = defineModel<boolean>('open', { default: false })

const store = useEditorStore()
const panels = useMessages('panels')
const pickerMessages = useMessages('panels/pickers')
const common = useMessages('common')
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
/** Why the chosen set shows nothing, when this host cannot draw it. */
const unavailableSet = computed(() =>
  search.set.value ? (setsByPrefix.value.get(search.set.value)?.unavailable ?? null) : null
)

const setOptions = computed<AppComboboxOption[]>(() => [
  { value: ALL_SETS, label: pickerMessages.value.allIconSets },
  ...search.sets.value.map((info) => ({
    value: info.prefix,
    label: info.name,
    meta: info.unavailable ? unavailableLabel(info.unavailable) : formatNumber(info.total),
    // A set this host cannot draw says where it is offered; choosing it says why in full.
    group: info.category ?? pickerMessages.value.otherIconSets
  }))
])

/** Where a set this host cannot draw is offered, short enough for the set menu. */
function unavailableLabel(reason: NonNullable<IconCollection['unavailable']>) {
  return reason === 'host' ? panels.value.iconSetMacAppOnly : panels.value.iconSetNeedsNewerMacOS
}
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
  // A set this host cannot draw lists nothing, not even its icons in the file, so the picker says
  // where it is offered instead.
  if (unavailableSet.value) return []
  if (query.value.trim()) return visible.value.map((name) => item(name))
  const prefix = search.set.value
  // Icons from a set this host cannot draw, such as SF Symbols in the browser, are left out.
  const inSet = (name: string) =>
    (!prefix || name.startsWith(`${prefix}:`)) &&
    !setsByPrefix.value.get(name.slice(0, name.indexOf(':')))?.unavailable
  const inFile = placed.value.filter(inSet)
  const recent = recentIcons.value.filter((name) => inSet(name) && !inFile.includes(name))
  const shown = new Set([...inFile, ...recent])
  const rest = visible.value.filter((name) => !shown.has(name))
  const named = [inFile, recent, rest].filter((group) => group.length > 0).length > 1
  const setLabel = named && prefix ? search.setName(`${prefix}:`) : undefined
  return [
    ...inFile.map((name) => item(name, pickerMessages.value.iconsInFile)),
    ...recent.map((name) => item(name, pickerMessages.value.recentIcons)),
    ...rest.map((name) => item(name, setLabel))
  ]
})

/** What the footer says with nothing highlighted: the results, the set, or how to start. */
const summary = computed(() => {
  if (query.value.trim()) {
    if (loading.value) return ''
    const count = search.found.value
    return search.capped.value
      ? pickerMessages.value.iconResultCountCapped({ count })
      : pickerMessages.value.iconResultCount(count)
  }
  const info = search.set.value ? setsByPrefix.value.get(search.set.value) : undefined
  if (info) return compact([info.name, info.license, formatNumber(info.total)]).join(' · ')
  return pickerMessages.value.iconSearchHint
})
/** The set and license of a highlighted icon. */
function details(name: string) {
  const info = setsByPrefix.value.get(name.slice(0, name.indexOf(':')))
  return compact([search.setName(name), info?.license]).join(' · ')
}

const emptyLabel = computed(() => {
  if (failed.value) return pickerMessages.value.iconSearchFailed
  // A set opened for an icon from it, such as one being swapped, says why it shows nothing.
  if (unavailableSet.value === 'host') return panels.value.sfSymbolsNeedMacApp
  if (unavailableSet.value === 'system') return panels.value.sfSymbolsNeedNewerMacOS
  // Typing searches; choosing a set loads it.
  if (loading.value)
    return query.value.trim()
      ? pickerMessages.value.searchingIcons
      : pickerMessages.value.loadingIcons
  return query.value.trim() || search.set.value
    ? pickerMessages.value.noIconsFound
    : pickerMessages.value.iconSearchHint
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
    :tooltip-side="tooltipSide"
    :side="side"
    :align="align"
    :search-placeholder="pickerMessages.searchIcons"
    :empty-label="emptyLabel"
    :close-label="common.close"
    @select="pick"
    @load-more="loadMore"
  >
    <template v-if="$slots.trigger" #trigger>
      <slot name="trigger" />
    </template>
    <template v-else #anchor>
      <slot name="anchor" />
    </template>
    <template #search-trailing>
      <AppCombobox
        v-model="chosenSet"
        :options="setOptions"
        :label="pickerMessages.iconSet"
        :search-placeholder="pickerMessages.searchIconSets"
        :empty-label="setsLoading ? pickerMessages.loadingIconSets : pickerMessages.noIconSetsFound"
        :result-limit="setOptions.length"
        align="end"
        :ui="{
          trigger:
            'me-1 h-5 w-auto max-w-32 shrink-0 border-0 bg-transparent px-1.5 hover:bg-hover',
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
    <template v-if="unavailableSet && !failed" #empty>
      {{ emptyLabel }}
      <ExternalLink :href="SF_SYMBOLS_DOCS_URL">{{ common.learnMore }}</ExternalLink>
    </template>
    <template #leading="{ item: entry }">
      <IconPreview :svg="previews.get(entry.value)" class="size-5 text-surface" />
    </template>
    <template v-if="items.length > 0" #footer="{ highlighted }">
      <p class="flex h-5 items-center gap-1.5 truncate px-1 text-2xs text-muted">
        <template v-if="highlighted">
          <span class="truncate text-surface">{{ highlighted.label }}</span>
          <span class="truncate">{{ details(highlighted.value) }}</span>
        </template>
        <span v-else class="truncate">{{ summary }}</span>
      </p>
    </template>
  </AppPicker>
</template>
