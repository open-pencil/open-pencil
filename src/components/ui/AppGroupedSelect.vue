<script setup lang="ts" generic="T extends string | number">
import { tv } from 'tailwind-variants'
import {
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectSeparator,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import theme from '@/theme/app-grouped-select'
import type { AppGroupedSelectTheme } from '@/theme/app-grouped-select'
import type { ComponentUI } from '@/components/ui/types'

interface SelectOption<TValue extends string | number> {
  value: TValue
  label: string
}

interface SelectGroupDef<TValue extends string | number> {
  label?: string
  items: SelectOption<TValue>[]
}

interface AppGroupedSelectProps<TValue extends string | number> {
  groups: SelectGroupDef<TValue>[]
  displayValue: string
  ui?: ComponentUI<AppGroupedSelectTheme>
}

defineOptions({ inheritAttrs: false })

const { groups, displayValue, ui } = defineProps<AppGroupedSelectProps<T>>()

const modelValue = defineModel<T>({ required: true })

const styles = tv(theme)()
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger v-bind="$attrs" :class="styles.trigger({ class: ui?.trigger })">
      <slot name="value">{{ displayValue }}</slot>
      <icon-lucide-chevron-down class="size-2.5 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        :class="styles.content({ class: ui?.content })"
      >
        <SelectViewport :class="styles.viewport({ class: ui?.viewport })">
          <template v-for="(group, index) in groups" :key="index">
            <SelectGroup>
              <SelectLabel v-if="group.label" :class="styles.label({ class: ui?.label })">
                {{ group.label }}
              </SelectLabel>
              <SelectItem
                v-for="item in group.items"
                :key="String(item.value)"
                :value="item.value"
                :class="styles.item({ class: ui?.item })"
              >
                <SelectItemText>{{ item.label }}</SelectItemText>
              </SelectItem>
            </SelectGroup>
            <SelectSeparator
              v-if="index < groups.length - 1"
              :class="styles.separator({ class: ui?.separator })"
            />
          </template>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
