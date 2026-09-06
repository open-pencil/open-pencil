<script lang="ts">
import type { VNode } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'
import type { FillSwatchSlotProps } from '@open-pencil/vue'
import type { ComponentUI } from '@/components/ui/types'
import type theme from '@/theme/paint/fill-swatch'

export type FillSwatchUI = ComponentUI<typeof theme>

export interface FillSwatchProps {
  fill: Fill
  label?: string
  ui?: FillSwatchUI
}

export interface FillSwatchSlots {
  default?(props: FillSwatchSlotProps): VNode[]
}
</script>

<script setup lang="ts">
import { computed, normalizeClass, useAttrs } from 'vue'
import { tv } from 'tailwind-variants'
import { FillSwatch as FillSwatchPrimitive } from '@open-pencil/vue'

import fillSwatchTheme from '@/theme/paint/fill-swatch'

const { fill, label, ui } = defineProps<FillSwatchProps>()
const attrs = useAttrs()
const styles = computed(() => tv(fillSwatchTheme)())
const forwardedAttrs = computed(() => {
  const { class: _class, ...rest } = attrs
  return rest
})
defineSlots<FillSwatchSlots>()
defineOptions({ inheritAttrs: false })
</script>

<template>
  <FillSwatchPrimitive
    v-slot="swatch"
    v-bind="forwardedAttrs"
    :fill="fill"
    :label="label"
    :class="styles.root({ class: [ui?.root, normalizeClass(attrs.class)] })"
  >
    <slot v-bind="swatch">
      <span
        :class="styles.preview({ class: ui?.preview })"
        :style="{ background: swatch.background }"
      />
    </slot>
  </FillSwatchPrimitive>
</template>
