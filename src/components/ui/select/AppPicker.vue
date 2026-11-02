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

const {
  heading,
  items,
  searchPlaceholder,
  emptyLabel,
  closeLabel,
  selected,
  tooltip,
  density = 'comfortable',
  layout = 'list',
  hasMore = false,
  loading = false,
  search = 'local',
  side = 'left',
  align = 'start',
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
// However the list closes, by the user or from outside through v-model, it reopens unfiltered.
watch(open, (isOpen) => {
  if (!isOpen) query.value = ''
})
const styles = computed(() => tv(theme)({ density, layout }))

const matches = computed(() => {
  const term = query.value.trim()
  return term && search === 'local'
    ? fuzzySearch(items, ['label', 'description', 'group'], term)
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
    <Tip v-if="slots.trigger" as-child :label="tooltip" :disabled="!tooltip">
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
              {{ emptyLabel }}
            </p>
            <ListboxGroup
              v-for="[group, entries] in groups"
              :key="group"
              :class="styles.group({ class: ui?.group })"
            >
              <ListboxGroupLabel v-if="group" :class="styles.groupLabel({ class: ui?.groupLabel })">
                {{ group }}
              </ListboxGroupLabel>
              <!-- Reka marks a disabled option only with data-disabled; assistive tech needs aria-disabled. -->
              <ListboxItem
                v-for="item in entries"
                :key="item.value"
                :value="item.value"
                :disabled="item.disabled"
                :aria-disabled="item.disabled || undefined"
                :aria-label="columns ? item.label : undefined"
                :data-selected="item.value === selected || undefined"
                :class="styles.item({ class: ui?.item })"
              >
                <span v-if="slots.leading" :class="styles.leading({ class: ui?.leading })">
                  <slot name="leading" :item="item" />
                </span>
                <span :class="styles.text({ class: ui?.text })">
                  <span :class="styles.label({ class: ui?.label })">{{ item.label }}</span>
                  <span
                    v-if="item.description && density === 'comfortable'"
                    :class="styles.description({ class: ui?.description })"
                  >
                    {{ item.description }}
                  </span>
                </span>
                <slot name="trailing" :item="item" />
                <icon-lucide-check
                  v-if="item.value === selected"
                  :class="styles.check({ class: ui?.check })"
                />
              </ListboxItem>
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
