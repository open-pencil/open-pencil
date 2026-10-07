<script lang="ts">
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
  side?: 'left' | 'right' | 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  ui?: ComponentUI<AppPickerTheme>
}

export interface AppPickerSlots {
  /** The control that opens the picker; rendered as the popover trigger. */
  trigger(): VNode[]
  /** Thumbnail or icon before an item's label. */
  leading?(props: { item: AppPickerItem }): VNode[]
  /** Actions below the list, such as creating a new choice. */
  footer?(props: { close: () => void }): VNode[]
}
</script>

<script setup lang="ts">
import {
  ListboxContent,
  ListboxFilter,
  ListboxGroup,
  ListboxGroupLabel,
  ListboxItem,
  ListboxRoot,
  PopoverClose,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
  type AcceptableValue
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import { fuzzySearch, useRetainedPopup } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import theme from '@/theme/select/picker'

const {
  heading,
  items,
  searchPlaceholder,
  emptyLabel,
  closeLabel,
  selected,
  tooltip,
  density = 'comfortable',
  side = 'left',
  align = 'start',
  ui
} = defineProps<AppPickerProps>()
const emit = defineEmits<{ select: [value: string] }>()
const slots = defineSlots<AppPickerSlots>()
const open = defineModel<boolean>('open', { default: false })
const { portalActive } = useRetainedPopup(open, () => close())
const query = ref('')
// However the list closes, by the user or from outside through v-model, it reopens unfiltered.
watch(open, (isOpen) => {
  if (!isOpen) query.value = ''
})
const styles = computed(() => tv(theme)({ density }))

const matches = computed(() => {
  const term = query.value.trim()
  return term ? fuzzySearch(items, ['label', 'description', 'group'], term) : items
})
const groups = computed(() => {
  const byGroup = new Map<string, AppPickerItem[]>()
  for (const item of matches.value) {
    const key = item.group ?? ''
    byGroup.set(key, [...(byGroup.get(key) ?? []), item])
  }
  return [...byGroup.entries()]
})

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
    <Tip as-child :label="tooltip" :disabled="!tooltip">
      <PopoverTrigger as-child>
        <slot name="trigger" />
      </PopoverTrigger>
    </Tip>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="8"
        :aria-label="heading"
        :class="styles.content({ class: ui?.content })"
        @open-auto-focus.prevent
      >
        <div :class="styles.header({ class: ui?.header })">
          <h3 :class="styles.title({ class: ui?.title })">{{ heading }}</h3>
          <PopoverClose as-child>
            <AppButton :aria-label="closeLabel" class="ml-auto">
              <icon-lucide-x class="size-3.5" />
            </AppButton>
          </PopoverClose>
        </div>
        <ListboxRoot
          class="flex min-h-0 flex-col"
          highlight-on-hover
          :aria-label="heading"
          @update:model-value="select"
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
          </div>
          <ListboxContent :class="styles.list({ class: ui?.list })">
            <p v-if="groups.length === 0" :class="styles.empty({ class: ui?.empty })">
              {{ emptyLabel }}
            </p>
            <ListboxGroup v-for="[group, entries] in groups" :key="group">
              <ListboxGroupLabel v-if="group" :class="styles.groupLabel({ class: ui?.groupLabel })">
                {{ group }}
              </ListboxGroupLabel>
              <ListboxItem
                v-for="item in entries"
                :key="item.value"
                :value="item.value"
                :disabled="item.disabled"
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
                <icon-lucide-check
                  v-if="item.value === selected"
                  :class="styles.check({ class: ui?.check })"
                />
              </ListboxItem>
            </ListboxGroup>
          </ListboxContent>
        </ListboxRoot>
        <div v-if="slots.footer" :class="styles.footer({ class: ui?.footer })">
          <slot name="footer" :close="close" />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
