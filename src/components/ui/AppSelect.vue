<script setup lang="ts" generic="T extends string | number">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'

import { testId as testIdAttr, type TestIdProps } from '@open-pencil/vue'

import { useSelectUI } from '@/components/ui/select'
import type { SelectUi } from '@/components/ui/select'

interface AppSelectUi extends SelectUi {
  viewport?: string
  indicator?: string
}

interface AppSelectProps<TValue extends string | number> extends TestIdProps {
  options: { value: TValue; label: string }[]
  placeholder?: string
  ui?: AppSelectUi
}

const {
  options,
  placeholder,
  ui,
  testId = 'app-select-trigger'
} = defineProps<AppSelectProps<T>>()

const modelValue = defineModel<T>({ required: true })

const select = useSelectUI({
  trigger: ui?.trigger ?? 'min-w-0 flex-1 rounded px-1.5 py-1 text-xs',
  content: ui?.content ?? 'max-h-56',
  item: ui?.item ?? 'rounded py-1.5 pr-2 pl-6 text-xs'
})
const viewport = ui?.viewport ?? 'p-0.5'
const indicator = ui?.indicator ?? 'absolute left-1.5 inline-flex items-center justify-center'
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger v-bind="testIdAttr(testId)" :class="select.trigger">
      <SelectValue :placeholder="placeholder" />
      <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent position="popper" :side-offset="2" :class="select.content">
        <SelectViewport :class="viewport">
          <SelectItem
            v-for="opt in options"
            :key="String(opt.value)"
            :value="opt.value"
            :class="select.item"
          >
            <SelectItemIndicator :class="indicator">
              <icon-lucide-check class="size-3 text-accent" />
            </SelectItemIndicator>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
