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

import LineStyleMenu from './LineStyleMenu.vue'
import ToolbarMenu from './ToolbarMenu.vue'

/** FigJam's section toolbar: its colour, its outline, renaming it, and locking it. */
const { single, locked } = defineProps<{
  /** Whether one section is selected, which can be renamed. */
  single: boolean
  /** Whether every selected section is locked. */
  locked: boolean
}>()
const emit = defineEmits<{ rename: [] }>()
const store = useEditorStore()
const toolbar = useFigJamStyle()
const figjam = useFigJamMessages()
const { menu } = useI18n()
const styles = tv(theme)()

/** Locks or unlocks every selected section alike, a mixed selection included. */
function setLocked(value: boolean) {
  const changing = [...store.state.selectedIds].filter(
    (id) => store.graph.getNode(id)?.locked !== value
  )
  store.undo.runBatch(value ? 'Lock' : 'Unlock', () =>
    changing.forEach((id) => store.toggleNodeLock(id))
  )
}

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
  <LineStyleMenu
    :style="toolbar.lineStyle.value"
    :color="toolbar.lineColor.value"
    @update:style="toolbar.setLineStyle($event)"
    @update:color="toolbar.setLineColor($event)"
  />
  <span :class="styles.divider()" />
  <IconButton
    v-if="single"
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
    @click="setLocked(!locked)"
  >
    <icon-lucide-lock v-if="locked" class="size-4" />
    <icon-lucide-lock-open v-else class="size-4" />
  </IconButton>
</template>
