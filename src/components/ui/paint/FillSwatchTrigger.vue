<script setup lang="ts">
import { computed, normalizeClass, useAttrs } from 'vue'

import type { Fill } from '@open-pencil/scene-graph'

import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import { fillSwatchTrigger } from '@/theme/paint/swatch-trigger'

const {
  fill,
  label,
  size = 'sm',
  disabled = false,
  background,
  ui
} = defineProps<{
  fill: Fill
  label: string
  size?: 'sm' | 'md'
  disabled?: boolean
  background?: string
  ui?: { root?: string; swatch?: string; preview?: string }
}>()
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
function forwardedAttrs() {
  const { class: _class, ...rest } = attrs
  return rest
}
const styles = computed(() => fillSwatchTrigger({ size }))
</script>

<template>
  <button
    v-bind="forwardedAttrs()"
    type="button"
    :aria-label="label"
    :disabled="disabled"
    data-slot="swatch-trigger"
    :class="styles.root({ class: [ui?.root, normalizeClass(attrs.class)] })"
  >
    <FillSwatch v-slot="swatch" :fill="fill" :class="styles.swatch({ class: ui?.swatch })">
      <span
        :class="styles.preview({ class: ui?.preview })"
        :style="{ background: background ?? swatch.background }"
      />
    </FillSwatch>
  </button>
</template>
