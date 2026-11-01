<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
import IconBan from '~icons/lucide/ban'
import IconMinus from '~icons/lucide/minus'
import IconSeparator from '~icons/lucide/separator-horizontal'

import type { FigJamColorName, FigJamLineStyle } from '@open-pencil/scene-graph/figjam'
import { useFigJamMessages, useShapeMessages } from '@open-pencil/vue/i18n'

import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import theme from '@/theme/figjam/toolbar'

import ToolbarMenu from './ToolbarMenu.vue'
import ToolbarOptions, { type ToolbarOption } from './ToolbarOptions.vue'

/**
 * FigJam's line menu for a shape's or section's outline: solid, dashed, or none, over the palette
 * its colour comes from. A style closes it; a colour leaves it open to try another, as in FigJam.
 */
const { style, color } = defineProps<{
  style: FigJamLineStyle | null
  color: FigJamColorName | null
}>()
const emit = defineEmits<{
  'update:style': [value: FigJamLineStyle]
  'update:color': [value: FigJamColorName]
}>()
const figjam = useFigJamMessages()
const shapes = useShapeMessages()
const styles = tv(theme)()

const options = computed<ToolbarOption<FigJamLineStyle>[]>(() => [
  { value: 'solid', label: figjam.value.solid, icon: IconMinus },
  { value: 'dashed', label: shapes.value.lineDashed, icon: IconSeparator },
  { value: 'none', label: shapes.value.lineNone, icon: IconBan }
])
</script>

<template>
  <ToolbarMenu :label="figjam.lineStyle" property="toolbar-line-style">
    <template #trigger>
      <icon-lucide-menu class="size-4" />
    </template>
    <div :class="styles.group()">
      <ToolbarOptions
        :label="figjam.lineStyle"
        :options="options"
        :selected="style"
        @select="emit('update:style', $event)"
      />
      <FigJamPalette
        :label="shapes.line"
        :selected="style === 'none' ? null : color"
        keeps-menu-open
        @select="emit('update:color', $event)"
      />
    </div>
  </ToolbarMenu>
</template>
