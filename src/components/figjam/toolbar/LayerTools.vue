<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { useFigJamStyle } from '@open-pencil/vue/controls/figjam-style'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { useFigJamColorCSS } from '@/components/figjam/color'
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
const figjam = useMessages('figjam')
const commands = useMessages('commands')
const styles = tv(theme)()

const dotColor = useFigJamColorCSS(() => toolbar.color.value)
</script>

<template>
  <ToolbarMenu :label="figjam.changeColor" property="toolbar-color">
    <template #trigger>
      <span :class="styles.dot()" :style="{ backgroundColor: dotColor }" />
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
