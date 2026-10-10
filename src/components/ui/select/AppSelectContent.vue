<script setup lang="ts">
import {
  SelectContent,
  SelectPortal,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectViewport
} from 'reka-ui'
import { computed } from 'vue'

import { useSelectUI } from '@/components/ui/select/select'
import type { SelectPlacement } from '@/components/ui/select/select'
import type { ComponentUI } from '@/components/ui/types'
import type theme from '@/theme/select/select'

interface AppSelectContentProps {
  /**
   * `over` needs a `SelectValue` in the trigger: Reka lines the chosen row's label up with it.
   * `below` suits triggers that show an icon or a mode instead of the value.
   */
  placement?: SelectPlacement
  align?: 'start' | 'center' | 'end'
  ui?: ComponentUI<typeof theme>
}

const { placement = 'below', align = 'start', ui } = defineProps<AppSelectContentProps>()

const styles = computed(() => useSelectUI({ ...ui, contentVariants: { placement } }))
const positioning = computed(() =>
  placement === 'over'
    ? { position: 'item-aligned' as const }
    : { position: 'popper' as const, align, sideOffset: 4, collisionPadding: 8 }
)
</script>

<template>
  <SelectPortal>
    <SelectContent v-bind="positioning" :class="styles.content">
      <SelectScrollUpButton :class="styles.scrollButton">
        <icon-lucide-chevron-up class="size-3" />
      </SelectScrollUpButton>
      <SelectViewport :class="styles.viewport"><slot /></SelectViewport>
      <SelectScrollDownButton :class="styles.scrollButton">
        <icon-lucide-chevron-down class="size-3" />
      </SelectScrollDownButton>
    </SelectContent>
  </SelectPortal>
</template>
