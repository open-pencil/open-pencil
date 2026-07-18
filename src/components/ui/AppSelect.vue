<script setup lang="ts" generic="T extends string | number">
import { tv } from 'tailwind-variants'
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'

import theme from '@/theme/app-select'
import type { AppSelectTheme } from '@/theme/app-select'
import type { ComponentUI } from '@/components/ui/types'

interface AppSelectProps<TValue extends string | number> {
  label?: string
  options: { value: TValue; label: string }[]
  placeholder?: string
  ui?: ComponentUI<AppSelectTheme>
}

defineOptions({ inheritAttrs: false })

const { options, label, placeholder, ui } = defineProps<AppSelectProps<T>>()
const modelValue = defineModel<T>({ required: true })
const styles = tv(theme)()
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger
      v-bind="$attrs"
      :class="styles.trigger({ class: ui?.trigger })"
      :aria-label="label"
    >
      <SelectValue :placeholder="placeholder" :class="styles.value({ class: ui?.value })" />
      <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="2"
        :class="styles.content({ class: ui?.content })"
      >
        <SelectScrollUpButton class="flex items-center justify-center py-0.5 text-muted">
          <icon-lucide-chevron-up class="size-3.5" />
        </SelectScrollUpButton>
        <SelectViewport :class="styles.viewport({ class: ui?.viewport })">
          <SelectItem
            v-for="opt in options"
            :key="String(opt.value)"
            :value="opt.value"
            :class="styles.item({ class: ui?.item })"
          >
            <SelectItemIndicator :class="styles.indicator({ class: ui?.indicator })">
              <icon-lucide-check class="size-3 text-accent" />
            </SelectItemIndicator>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
        <SelectScrollDownButton class="flex items-center justify-center py-0.5 text-muted">
          <icon-lucide-chevron-down class="size-3.5" />
        </SelectScrollDownButton>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
