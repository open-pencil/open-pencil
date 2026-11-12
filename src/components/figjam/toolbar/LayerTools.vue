<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import { figJamColor } from '@open-pencil/scene-graph/figjam'
import { useFigJamStyle } from '@open-pencil/vue/controls/figjam-style'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/figjam/toolbar'

import ToolbarMenu from './ToolbarMenu.vue'

/**
 * FigJam's toolbar for text and plain layers: their colour, and for a group a way to ungroup it.
 * Text adds its text menus beside this.
 */
const { ungroup = false } = defineProps<{
  /** Whether a single group is selected, which the toolbar offers to ungroup. */
  ungroup?: boolean
}>()
const store = useEditorStore()
const toolbar = useFigJamStyle()
const figjam = useFigJamMessages()
const { commands } = useI18n()
const styles = tv(theme)()

const hex = computed(() =>
  toolbar.color.value ? colorToHex(figJamColor(toolbar.color.value)) : undefined
)
</script>

<template>
  <ToolbarMenu :label="figjam.changeColor" property="toolbar-color">
    <template #trigger>
      <span :class="styles.dot()" :style="{ backgroundColor: hex }" />
    </template>
    <FigJamPalette
      :label="figjam.changeColor"
      :selected="toolbar.color.value"
      @select="toolbar.setColor($event)"
    />
  </ToolbarMenu>
  <template v-if="ungroup">
    <span :class="styles.divider()" />
    <IconButton
      size="md"
      :label="commands.ungroup"
      data-property="toolbar-ungroup"
      @click="store.ungroupSelected()"
    >
      <icon-lucide-ungroup class="size-4" />
    </IconButton>
  </template>
</template>
