<script setup lang="ts" generic="T extends string | number">
import {
  SelectGroup,
  SelectLabel,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, useSlots } from 'vue'

import { useRetainedPopup } from '@open-pencil/vue'

import AppSelectContent from '@/components/ui/select/AppSelectContent.vue'
import AppSelectItem from '@/components/ui/select/AppSelectItem.vue'
import type {
  AppSelectGroup,
  AppSelectOption,
  SelectPlacement
} from '@/components/ui/select/select'
import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/select/app'
import type { AppSelectTheme } from '@/theme/select/app'

interface AppSelectProps<TValue extends string | number> {
  label?: string
  /** A flat list; pass `groups` instead to divide it. */
  options?: AppSelectOption<TValue>[]
  groups?: AppSelectGroup<TValue>[]
  /** Shown when the value matches no option, such as a size that fits no preset. */
  placeholder?: string
  /**
   * Defaults to `over` when the built-in trigger shows a chosen option, and to `below` for a
   * `trigger` slot or a value outside the options: there is no row to line up with the trigger.
   */
  placement?: SelectPlacement
  ui?: ComponentUI<AppSelectTheme>
}

defineOptions({ inheritAttrs: false })

const { options, groups, label, placeholder, placement, ui } = defineProps<AppSelectProps<T>>()
const modelValue = defineModel<T>({ required: true })
const slots = useSlots()
const styles = tv(theme)()
const { open: popupOpen, portalActive } = useRetainedPopup()

const optionGroups = computed<AppSelectGroup<T>[]>(() => groups ?? [{ options: options ?? [] }])
const selectedLabel = computed(
  () =>
    optionGroups.value
      .flatMap((group) => group.options)
      .find((option) => option.value === modelValue.value)?.label
)
const contentPlacement = computed(
  () => placement ?? (slots.trigger || selectedLabel.value === undefined ? 'below' : 'over')
)
const contentUI = computed(() => ({
  content: ui?.content,
  viewport: ui?.viewport,
  scrollButton: ui?.scrollButton
}))
const itemUI = computed(() => ({ item: ui?.item, indicator: ui?.indicator }))
</script>

<template>
  <SelectRoot v-model="modelValue" v-model:open="popupOpen">
    <SelectTrigger v-if="$slots.trigger" as-child :aria-label="label" v-bind="$attrs">
      <slot name="trigger" />
    </SelectTrigger>
    <SelectTrigger
      v-else
      :aria-label="label"
      v-bind="$attrs"
      :class="styles.trigger({ class: ui?.trigger })"
    >
      <SelectValue :placeholder="placeholder" :class="styles.value({ class: ui?.value })">
        {{ selectedLabel ?? placeholder }}
      </SelectValue>
      <icon-lucide-chevron-down :class="styles.chevron({ class: ui?.chevron })" />
    </SelectTrigger>
    <AppSelectContent v-if="portalActive" :placement="contentPlacement" :ui="contentUI">
      <template v-for="(group, index) in optionGroups" :key="index">
        <SelectSeparator v-if="index > 0" :class="styles.separator({ class: ui?.separator })" />
        <SelectGroup>
          <SelectLabel v-if="group.label" :class="styles.label({ class: ui?.label })">
            {{ group.label }}
          </SelectLabel>
          <AppSelectItem
            v-for="option in group.options"
            :key="String(option.value)"
            :value="option.value"
            :disabled="option.disabled"
            :ui="itemUI"
          >
            {{ option.label }}
            <template #end><slot name="option-end" :option="option" /></template>
          </AppSelectItem>
        </SelectGroup>
      </template>
    </AppSelectContent>
  </SelectRoot>
</template>
