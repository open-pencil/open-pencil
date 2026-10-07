<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import theme from '@/theme/select/app'

/** A select-looking field whose choices open in the searchable picker. */
const { label, items, searchPlaceholder, emptyLabel, closeLabel, placeholder } = defineProps<{
  label: string
  items: AppPickerItem[]
  searchPlaceholder: string
  emptyLabel: string
  closeLabel: string
  /** Shown when the value matches no item, such as a mixed selection. */
  placeholder?: string
}>()
const value = defineModel<string>({ required: true })
defineSlots<{
  leading?(props: { item: AppPickerItem }): unknown
  /** An action under the list, such as creating a new item. */
  footer?(props: { close: () => void }): unknown
}>()
defineOptions({ inheritAttrs: false })
const styles = tv(theme)()
const current = computed(() => items.find((item) => item.value === value.value))
</script>

<template>
  <AppPicker
    :heading="label"
    :items="items"
    :selected="value"
    density="compact"
    :search-placeholder="searchPlaceholder"
    :empty-label="emptyLabel"
    :close-label="closeLabel"
    @select="value = $event"
  >
    <template #trigger>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        v-bind="$attrs"
        :aria-label="label"
        :class="styles.trigger()"
      >
        <span :class="styles.value()">{{ current?.label ?? placeholder ?? value }}</span>
        <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
      </button>
    </template>
    <template v-if="$slots.leading" #leading="{ item }">
      <slot name="leading" :item="item" />
    </template>
    <template v-if="$slots.footer" #footer="{ close }">
      <slot name="footer" :close="close" />
    </template>
  </AppPicker>
</template>
