<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { provide } from 'vue'

import Tip from '@/components/ui/overlay/Tip.vue'
import theme from '@/theme/figjam/toolbar'
import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

import { CLOSE_TOOLBAR_MENU } from './menu'

/**
 * A button of FigJam's selection toolbar that opens a menu above it: its trigger shows the current
 * choice and a chevron, as FigJam's colour, line and text menus do.
 */
const { label, property } = defineProps<{
  /** Accessible name and tooltip. */
  label: string
  /** The `data-property` tests find the trigger by. */
  property?: string
}>()
const open = defineModel<boolean>('open', { default: false })
const styles = tv(theme)()
provide(CLOSE_TOOLBAR_MENU, () => {
  open.value = false
})

/** How far a menu opens above its button. */
const MENU_GAP = 8
</script>

<template>
  <PopoverRoot v-model:open="open">
    <Tip as-child :label="label" :disabled="open">
      <PopoverTrigger :aria-label="label" :data-property="property" :class="styles.trigger()">
        <slot name="trigger" />
        <icon-lucide-chevron-down :class="styles.chevron()" />
      </PopoverTrigger>
    </Tip>
    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="MENU_GAP"
        :collision-padding="8"
        :class="[styles.popover(), floatingSurface, motionStyles.floating]"
        :data-menu="property"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
