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

import { selectContent, selectItem, selectTrigger } from '@/components/ui/select'

const { options, placeholder } = defineProps<{
  options: { value: T; label: string }[]
  placeholder?: string
}>()

const modelValue = defineModel<T>({ required: true })
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger
      data-test-id="app-select-trigger"
      :class="selectTrigger({ class: 'min-w-0 flex-1 rounded px-1.5 py-1 text-xs' })"
    >
      <SelectValue :placeholder="placeholder" />
      <icon-lucide-chevron-down class="ml-1 size-3 shrink-0 text-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="2"
        :class="selectContent({ class: 'max-h-56' })"
      >
        <SelectViewport class="p-0.5">
          <SelectItem
            v-for="opt in options"
            :key="String(opt.value)"
            :value="opt.value"
            :class="selectItem({ class: 'rounded py-1.5 pl-6 pr-2 text-xs' })"
          >
            <SelectItemIndicator class="absolute left-1.5 inline-flex items-center justify-center">
              <icon-lucide-check class="size-3 text-accent" />
            </SelectItemIndicator>
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
