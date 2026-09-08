<script setup lang="ts" generic="T extends string | number">
import { tv } from 'tailwind-variants'
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

import { selectTheme } from '#ui/theme/select'

defineOptions({ inheritAttrs: false })

const { options, label } = defineProps<{
  label: string
  options: Array<{ value: T; label: string; disabled?: boolean }>
}>()
const modelValue = defineModel<T>({ required: true })
const styles = tv(selectTheme)()
</script>

<template>
  <SelectRoot v-model="modelValue">
    <SelectTrigger v-bind="$attrs" :class="styles.trigger()" :aria-label="label">
      <SelectValue :class="styles.value()" />
      <span aria-hidden="true" class="ml-1 size-1.5 shrink-0 rotate-45 border-r border-b border-muted" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        align="end"
        :side-offset="4"
        :collision-padding="8"
        :body-lock="false"
        :class="styles.content()"
      >
        <SelectViewport :class="styles.viewport()">
          <SelectItem
            v-for="option in options"
            :key="String(option.value)"
            :value="option.value"
            :disabled="option.disabled"
            :class="styles.item()"
          >
            <SelectItemIndicator :class="styles.indicator()">
              <span aria-hidden="true" class="block h-2.5 w-1.5 rotate-45 border-r-2 border-b-2 border-accent" />
            </SelectItemIndicator>
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
