<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { colorToHex } from '@open-pencil/scene-graph/color'
import { figJamColor } from '@open-pencil/scene-graph/figjam'
import { useFigJamToolbar } from '@open-pencil/vue/controls/figjam-toolbar'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import FigJamPalette from '@/components/figjam/FigJamPalette.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/figjam/toolbar'

import LineStyleMenu from './LineStyleMenu.vue'
import ToolbarMenu from './ToolbarMenu.vue'

/** FigJam's section toolbar: its colour, its outline, renaming it, and locking it. */
const emit = defineEmits<{ rename: [] }>()
const store = useEditorStore()
const toolbar = useFigJamToolbar()
const figjam = useFigJamMessages()
const { menu } = useI18n()
const styles = tv(theme)()

const hex = computed(() =>
  toolbar.color.value ? colorToHex(figJamColor(toolbar.color.value)) : undefined
)
const locked = computed(() => toolbar.layers.value.every((layer) => layer.locked))
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
  <LineStyleMenu
    :style="toolbar.lineStyle.value"
    :color="toolbar.lineColor.value"
    @update:style="toolbar.setLineStyle($event)"
    @update:color="toolbar.setLineColor($event)"
  />
  <span :class="styles.divider()" />
  <IconButton
    v-if="toolbar.layers.value.length === 1"
    size="md"
    :label="figjam.renameSection"
    data-property="toolbar-rename"
    @click="emit('rename')"
  >
    <icon-lucide-text-cursor-input class="size-4" />
  </IconButton>
  <IconButton
    size="md"
    toggle
    :label="locked ? menu.unlock : menu.lock"
    :active="locked"
    data-property="toolbar-lock"
    @click="store.toggleLock()"
  >
    <icon-lucide-lock v-if="locked" class="size-4" />
    <icon-lucide-lock-open v-else class="size-4" />
  </IconButton>
</template>
