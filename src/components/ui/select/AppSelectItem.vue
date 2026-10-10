<script setup lang="ts">
import { SelectItem, SelectItemIndicator, SelectItemText } from 'reka-ui'
import { computed } from 'vue'

import { useSelectUI } from '@/components/ui/select/select'
import type { ComponentUI } from '@/components/ui/types'
import type theme from '@/theme/select/select'

interface AppSelectItemProps {
  value: string | number
  disabled?: boolean
  textValue?: string
  ui?: Pick<ComponentUI<typeof theme>, 'item' | 'indicator'>
}

const { value, disabled, textValue, ui } = defineProps<AppSelectItemProps>()

const styles = computed(() => useSelectUI(ui))
</script>

<template>
  <SelectItem :value="value" :disabled="disabled" :text-value="textValue" :class="styles.item">
    <SelectItemIndicator :class="styles.indicator">
      <icon-lucide-check class="size-3" />
    </SelectItemIndicator>
    <SelectItemText><slot /></SelectItemText>
    <slot name="end" />
  </SelectItem>
</template>
