<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import { figJamColor } from '@open-pencil/scene-graph/figjam'
import { useShapeWithText } from '@open-pencil/vue/controls/shape-with-text'
import { useFigJamMessages, useShapeMessages } from '@open-pencil/vue/i18n'

import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import { SHAPE_KIND_ICONS } from '@/components/icons/shapes'
import ShapeKindPicker from '@/components/shapes/ShapeKindPicker.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/figjam/toolbar'

import LineStyleMenu from './LineStyleMenu.vue'
import TextTools from './TextTools.vue'
import ToolbarMenu from './ToolbarMenu.vue'

/**
 * FigJam's shape toolbar: the shape switcher, its colour with see-through and empty fills, its
 * outline, and, once the shape has a label, its text menus.
 */
const shape = useShapeWithText()
const shapes = useShapeMessages()
const figjam = useFigJamMessages()
const styles = tv(theme)()

const fillHex = computed(() =>
  shape.color.value ? colorToHex(figJamColor(shape.color.value)) : undefined
)
const kind = computed(() => shape.kind.value ?? 'SQUARE')
</script>

<template>
  <ShapeKindPicker
    :heading="shapes.kind"
    :selected="kind"
    side="top"
    align="start"
    @select="shape.setKind($event)"
  >
    <template #trigger>
      <button
        type="button"
        aria-haspopup="listbox"
        :aria-label="shapes.kind"
        data-property="toolbar-shape-kind"
        :class="styles.trigger()"
      >
        <component :is="SHAPE_KIND_ICONS[kind]" class="size-4" />
        <icon-lucide-chevron-down :class="styles.chevron()" />
      </button>
    </template>
  </ShapeKindPicker>
  <span :class="styles.divider()" />
  <ToolbarMenu :label="figjam.changeColor" property="toolbar-color">
    <template #trigger>
      <span :class="styles.dot()" :style="{ backgroundColor: fillHex }" />
    </template>
    <div :class="styles.group()">
      <IconButton
        toggle
        :label="shapes.fillTransparent"
        :active="shape.fillMode.value === 'transparent'"
        data-property="toolbar-fill-transparent"
        @click="shape.setFillMode(shape.fillMode.value === 'transparent' ? 'fill' : 'transparent')"
      >
        <icon-lucide-contrast class="size-3.5" />
      </IconButton>
      <FigJamPalette
        :label="shapes.fill"
        :selected="shape.color.value"
        :none-label="shapes.fillNone"
        :none="shape.fillMode.value === 'none'"
        @select="shape.setColor($event)"
        @none="shape.setFillMode('none')"
      />
    </div>
  </ToolbarMenu>
  <LineStyleMenu
    :style="shape.lineStyle.value"
    :color="shape.lineColor.value"
    @update:style="shape.setLineStyle($event)"
    @update:color="shape.setLineColor($event)"
  />
  <template v-if="shape.textSize.value">
    <span :class="styles.divider()" />
    <TextTools align />
  </template>
</template>
