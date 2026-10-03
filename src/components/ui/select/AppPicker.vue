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
  title: string
  items: AppPickerItem[]
  searchPlaceholder: string
  emptyLabel: string
  closeLabel: string
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
import Fuse from 'fuse.js'
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
import { computed, ref } from 'vue'

import { useRetainedPopup } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import theme from '@/theme/select/picker'

const {
  title,
  items,
  searchPlaceholder,
  emptyLabel,
  closeLabel,
  density = 'comfortable',
  side = 'left',
  align = 'start',
  ui
} = defineProps<AppPickerProps>()
const emit = defineEmits<{ select: [value: string] }>()
const slots = defineSlots<AppPickerSlots>()
const { open, portalActive } = useRetainedPopup()
const query = ref('')
const styles = computed(() => tv(theme)({ density }))

const index = computed(
  () =>
    new Fuse(items, {
      keys: ['label', 'description', 'group'],
      threshold: 0.2,
      ignoreLocation: true
    })
)
const matches = computed(() => {
  const term = query.value.trim()
  return term ? index.value.search(term).map((result) => result.item) : items
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
  query.value = ''
}

function select(value: AcceptableValue) {
  if (typeof value !== 'string') return
  close()
  emit('select', value)
}
</script>

<template>
  <PopoverRoot v-model:open="open" @update:open="!$event && (query = '')">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverPortal v-if="portalActive">
      <PopoverContent
        :side="side"
        :align="align"
        :side-offset="8"
        :aria-label="title"
        :class="styles.content({ class: ui?.content })"
        @open-auto-focus.prevent
      >
        <div :class="styles.header({ class: ui?.header })">
          <h3 :class="styles.title({ class: ui?.title })">{{ title }}</h3>
          <PopoverClose as-child>
            <AppButton :aria-label="closeLabel" class="ml-auto">
              <icon-lucide-x class="size-3.5" />
            </AppButton>
          </PopoverClose>
        </div>
        <ListboxRoot
          class="flex min-h-0 flex-col"
          highlight-on-hover
          :aria-label="title"
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
