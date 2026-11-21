<script lang="ts">
import { clamp } from 'es-toolkit'
import type { VNode } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import type { AppPickerTheme } from '@/theme/select/picker'

export interface AppPickerItem {
  value: string
  label: string
  description?: string
  /** Items keep their order; groups appear in the order their first item does. */
  group?: string
  /** The name assistive tech reads when `label` is only part of it, as `500` of `color/red/500`. */
  accessibleName?: string
  /** A heading within the group that its folders and items sit under, such as `color`. */
  section?: string
  /**
   * A collapsible set within the group, such as a palette's shades, placed where its first item
   * is. Closed until opened, unless it holds the selected item, is in `openFolders`, or a
   * search shows what it matches.
   */
  folder?: string
  disabled?: boolean
}

export interface AppPickerProps {
  /** Header text of the open list, also its accessible name. */
  heading: string
  items: AppPickerItem[]
  searchPlaceholder: string
  emptyLabel: string
  closeLabel: string
  /** The current choice, marked with a check. */
  selected?: string
  /** Tooltip on the trigger; wraps the popover trigger so both reach the same element. */
  tooltip?: string
  /** Where the trigger's tooltip opens; the list's own `side` does not move it. */
  tooltipSide?: 'left' | 'right' | 'top' | 'bottom'
  density?: 'compact' | 'comfortable'
  /**
   * `grid` shows each item's thumbnail alone, eight to a row, with the highlighted item's label
   * passed to the footer; for browsing many items by sight, such as icons. `gallery` does the
   * same with larger thumbnails three to a row, for pictures such as photos.
   */
  layout?: 'list' | 'grid' | 'gallery'
  /** More items follow the shown ones; scrolling near the end emits `loadMore`. */
  hasMore?: boolean
  /** The items are on their way: placeholders stand in for them, and `emptyLabel` is announced. */
  loading?: boolean
  /**
   * `local` filters `items` by the query; `remote` shows them as given, for a list the owner
   * searches itself through `v-model:query`.
   */
  search?: 'local' | 'remote'
  side?: 'left' | 'right' | 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  /** Folders that start open, by name, such as recent choices. */
  openFolders?: readonly string[]
  /**
   * Groups and section headings open and close, starting open, so a long list such as a design
   * system's variables can be folded down to what is wanted.
   */
  collapsible?: boolean
  ui?: ComponentUI<AppPickerTheme>
}

export interface AppPickerSlots {
  /** The control that opens the picker; rendered as the popover trigger. */
  trigger?(): VNode[]
  /**
   * What the list opens beside when the owner opens it through `v-model:open` instead of a
   * trigger, such as from a context menu; used when there is no `trigger`.
   */
  anchor?(): VNode[]
  /** Thumbnail or icon before an item's label. */
  leading?(props: { item: AppPickerItem }): VNode[]
  /**
   * Controls in the header before the close button, for a choice the whole picker follows, such
   * as the service it searches; it stays put while the `setup` view replaces the list.
   */
  actions?(): VNode[]
  /** A control at the end of the search field that narrows the list, such as a category. */
  'search-trailing'?(): VNode[]
  trailing?(props: { item: AppPickerItem }): VNode[]
  /** A summary of a folder's items beside its name, such as the colors it holds. */
  folder?(props: { folder: string; items: AppPickerItem[] }): VNode[]
  /** What the list says when it has nothing to show, such as a link; `emptyLabel` by default. */
  empty?(): VNode[]
  /**
   * Shown instead of the search and list while the picker needs something before it can list
   * anything, such as a service's key.
   */
  setup?(): VNode[]
  /** Actions or details below the list; `highlighted` is the item under the pointer or keys. */
  footer?(props: { close: () => void; highlighted: AppPickerItem | null }): VNode[]
}
</script>

<script setup lang="ts">
import { useInfiniteScroll, unrefElement } from '@vueuse/core'
import {
  ListboxContent,
  ListboxFilter,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxRoot,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  type AcceptableValue
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, shallowRef, useTemplateRef, watch, type ComponentPublicInstance } from 'vue'

import { useRetainedPopup } from '@open-pencil/vue/lifecycle/retention'
import { fuzzySearch } from '@open-pencil/vue/shared/search'

import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import theme, { APP_PICKER_COLUMNS } from '@/theme/select/picker'

import { folderKey, pickerRows, type AppPickerRow } from './folders'

const {
  heading,
  items,
  searchPlaceholder,
  emptyLabel,
  closeLabel,
  selected,
  tooltip,
  tooltipSide = 'top',
  density = 'comfortable',
  layout = 'list',
  hasMore = false,
  loading = false,
  search = 'local',
  side = 'left',
  align = 'start',
  openFolders = [],
  collapsible = false,
  ui
} = defineProps<AppPickerProps>()
const emit = defineEmits<{
  select: [value: string]
  loadMore: []
  closeAutoFocus: [event: Event]
}>()
const slots = defineSlots<AppPickerSlots>()
const open = defineModel<boolean>('open', { default: false })
const { portalActive } = useRetainedPopup(open, () => close())
const query = defineModel<string>('query', { default: '' })
/** Folders the user opened or closed against how they start, by key. */
const toggledFolders = shallowRef<ReadonlySet<string>>(new Set())
// However the list closes, by the user or from outside through v-model, it reopens unfiltered,
// its folders as they start.
watch(open, (isOpen) => {
  if (isOpen) return
  query.value = ''
  toggledFolders.value = new Set()
})
const styles = computed(() => tv(theme)({ density, layout }))

const matches = computed(() => {
  const term = query.value.trim()
  return term && search === 'local'
    ? fuzzySearch(items, ['label', 'accessibleName', 'description', 'group', 'folder'], term)
    : items
})
const groups = computed(() => {
  const byGroup = new Map<string, AppPickerItem[]>()
  for (const item of matches.value) {
    const key = item.group ?? ''
    byGroup.set(key, [...(byGroup.get(key) ?? []), item])
  }
  return [...byGroup.entries()]
})

function startsOpen(folder: string, entries: AppPickerItem[]): boolean {
  return openFolders.includes(folder) || entries.some((item) => item.value === selected)
}

function isFolderOpen(key: string, folder: string, entries: AppPickerItem[]): boolean {
  if (query.value.trim()) return true
  return startsOpen(folder, entries) !== toggledFolders.value.has(key)
}

function toggleFolder(key: string) {
  const next = new Set(toggledFolders.value)
  if (!next.delete(key)) next.add(key)
  toggledFolders.value = next
}

/** A group or section heading, which starts open, shows its choices unless closed. */
function isHeadingOpen(key: string): boolean {
  if (!collapsible || query.value.trim()) return true
  return !toggledFolders.value.has(key)
}

function groupKey(group: string): string {
  return folderKey(group, '')
}

const openness = { folder: isFolderOpen, section: isHeadingOpen }

/** Each group's rows: its choices, with headings and folders closed or open. */
const groupRows = computed<[string, AppPickerRow<AppPickerItem>[]][]>(() =>
  groups.value.map(([group, entries]) => [
    group,
    isHeadingOpen(groupKey(group)) ? pickerRows(group, entries, openness) : []
  ])
)

const highlighted = shallowRef<AppPickerItem | null>(null)
watch(matches, () => {
  highlighted.value = null
})
function highlight(payload: { value: AcceptableValue } | undefined) {
  highlighted.value = matches.value.find((item) => item.value === payload?.value) ?? null
}

/** Thumbnails a row in the grid and gallery layouts; null for a list. */
const columns = computed(() => (layout === 'list' ? null : APP_PICKER_COLUMNS[layout]))
/** Placeholders shown while loading: the visible rows of thumbnails, or a few list rows. */
const LOADING_PLACEHOLDERS = computed(
  () => ({ list: 3, grid: APP_PICKER_COLUMNS.grid * 7, gallery: 12 })[layout]
)

const ROW_KEYS = new Map([
  ['ArrowDown', 1],
  ['ArrowUp', -1]
])
// ListboxRoot is generic, so its instance type is spelled as the part used here.
const listbox = useTemplateRef<{ highlightItem: (value: AcceptableValue) => void }>('listboxRoot')
// Reka moves through a listbox one item at a time. A grid lays it out horizontally, so
// left and right move an item, and up and down move a row here; with nothing highlighted, they
// start at the first item.
function moveRow(event: KeyboardEvent) {
  const rows = ROW_KEYS.get(event.key)
  const perRow = columns.value
  if (!perRow || !rows) return
  event.preventDefault()
  const current = highlighted.value?.value
  const index = matches.value.findIndex((item) => item.value === current)
  const target = index === -1 ? 0 : index + rows * perRow
  const next = matches.value[clamp(target, 0, matches.value.length - 1)]
  if (next) listbox.value?.highlightItem(next.value)
}

const list = useTemplateRef<ComponentPublicInstance>('listContent')
useInfiniteScroll(
  () => unrefElement(list),
  () => emit('loadMore'),
  {
    distance: 120,
    canLoadMore: () => open.value && hasMore
  }
)

function close() {
  open.value = false
}

function select(value: AcceptableValue) {
  if (typeof value !== 'string') return
  close()
  emit('select', value)
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <Tip v-if="slots.trigger" as-child :side="tooltipSide" :label="tooltip" :disabled="!tooltip">
      <PopoverTrigger as-child>
        <slot name="trigger" />
      </PopoverTrigger>
    </Tip>
    <PopoverAnchor v-else as-child>
      <slot name="anchor" />
    </PopoverAnchor>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="8"
        :collision-padding="8"
        :aria-label="heading"
        :class="styles.content({ class: ui?.content })"
        @open-auto-focus.prevent
        @close-auto-focus="emit('closeAutoFocus', $event)"
      >
        <div :class="styles.header({ class: ui?.header })">
          <h3 :class="styles.title({ class: ui?.title })">{{ heading }}</h3>
          <slot name="actions" />
          <PopoverClose as-child>
            <IconButton :label="closeLabel">
              <icon-lucide-x class="size-3.5" />
            </IconButton>
          </PopoverClose>
        </div>
        <div v-if="slots.setup" :class="styles.setup({ class: ui?.setup })">
          <slot name="setup" />
        </div>
        <ListboxRoot
          v-else
          ref="listboxRoot"
          class="flex min-h-0 flex-1 flex-col"
          highlight-on-hover
          :orientation="columns ? 'horizontal' : 'vertical'"
          @update:model-value="select"
          @highlight="highlight"
          @keydown="moveRow"
        >
          <div :class="styles.search({ class: ui?.search })">
            <icon-lucide-search :class="styles.searchIcon({ class: ui?.searchIcon })" />
            <ListboxFilter
              v-model="query"
              auto-focus
              :placeholder="searchPlaceholder"
              :aria-label="searchPlaceholder"
              :class="styles.input({ class: ui?.input })"
            />
            <slot name="search-trailing" />
          </div>
          <ListboxContent
            ref="listContent"
            :class="styles.list({ class: ui?.list })"
            :aria-label="heading"
          >
            <div v-if="groups.length === 0 && loading" :class="styles.group({ class: ui?.group })">
              <span class="sr-only" role="status">{{ emptyLabel }}</span>
              <span
                v-for="index in LOADING_PLACEHOLDERS"
                :key="index"
                aria-hidden="true"
                :class="styles.placeholder({ class: ui?.placeholder })"
              />
            </div>
            <p v-else-if="groups.length === 0" :class="styles.empty({ class: ui?.empty })">
              <slot name="empty">{{ emptyLabel }}</slot>
            </p>
            <ListboxGroup
              v-for="[group, rows] in groupRows"
              :key="group"
              :class="styles.group({ class: ui?.group })"
            >
              <ListboxGroupLabel v-if="group" :class="styles.groupLabel({ class: ui?.groupLabel })">
                <button
                  v-if="collapsible"
                  type="button"
                  :aria-expanded="isHeadingOpen(groupKey(group))"
                  :class="styles.headingToggle({ class: ui?.headingToggle })"
                  data-slot="group-toggle"
                  @click="toggleFolder(groupKey(group))"
                >
                  <icon-lucide-chevron-right
                    data-direction="reading"
                    :class="styles.folderIcon({ class: ui?.folderIcon })"
                    :data-open="isHeadingOpen(groupKey(group)) || undefined"
                  />
                  {{ group }}
                </button>
                <template v-else>{{ group }}</template>
              </ListboxGroupLabel>
              <template v-for="row in rows" :key="row.kind === 'item' ? row.item.value : row.key">
                <button
                  v-if="row.kind === 'section' && collapsible"
                  type="button"
                  :aria-expanded="row.open"
                  :class="styles.section({ class: [styles.headingToggle(), ui?.section] })"
                  data-slot="section"
                  @click="toggleFolder(row.key)"
                >
                  <icon-lucide-chevron-right
                    data-direction="reading"
                    :class="styles.folderIcon({ class: ui?.folderIcon })"
                    :data-open="row.open || undefined"
                  />
                  {{ row.name }}
                </button>
                <div
                  v-else-if="row.kind === 'section'"
                  :class="styles.section({ class: ui?.section })"
                  data-slot="section"
                >
                  {{ row.name }}
                </div>
                <button
                  v-else-if="row.kind === 'folder'"
                  type="button"
                  :aria-expanded="row.open"
                  :class="styles.folder({ class: ui?.folder })"
                  data-slot="folder"
                  @click="toggleFolder(row.key)"
                >
                  <icon-lucide-chevron-right
                    data-direction="reading"
                    :class="styles.folderIcon({ class: ui?.folderIcon })"
                    :data-open="row.open || undefined"
                  />
                  <span :class="styles.folderLabel({ class: ui?.folderLabel })">{{
                    row.name
                  }}</span>
                  <slot name="folder" :folder="row.name" :items="row.items" />
                </button>
                <!-- Reka marks a disabled option only with data-disabled; assistive tech needs aria-disabled. -->
                <ListboxItem
                  v-else
                  :value="row.item.value"
                  :disabled="row.item.disabled"
                  :aria-disabled="row.item.disabled || undefined"
                  :aria-label="row.item.accessibleName ?? (columns ? row.item.label : undefined)"
                  :data-selected="row.item.value === selected || undefined"
                  :data-nested="row.nested || undefined"
                  :class="styles.item({ class: ui?.item })"
                >
                  <span v-if="slots.leading" :class="styles.leading({ class: ui?.leading })">
                    <slot name="leading" :item="row.item" />
                  </span>
                  <span :class="styles.text({ class: ui?.text })">
                    <span :class="styles.label({ class: ui?.label })">{{ row.item.label }}</span>
                    <span
                      v-if="row.item.description && density === 'comfortable'"
                      :class="styles.description({ class: ui?.description })"
                    >
                      {{ row.item.description }}
                    </span>
                  </span>
                  <slot name="trailing" :item="row.item" />
                  <icon-lucide-check
                    v-if="row.item.value === selected"
                    :class="styles.check({ class: ui?.check })"
                  />
                </ListboxItem>
              </template>
            </ListboxGroup>
          </ListboxContent>
        </ListboxRoot>
        <div v-if="slots.footer" :class="styles.footer({ class: ui?.footer })">
          <slot name="footer" :close="close" :highlighted="highlighted" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
