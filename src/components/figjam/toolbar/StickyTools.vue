<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { STICKY_COLORS } from '@open-pencil/scene-graph/generated'
import { useStickyNote } from '@open-pencil/vue/controls/sticky'
import { useFigJamMessages, useI18n } from '@open-pencil/vue/i18n'

import FigJamSwatches from '@/components/figjam/FigJamSwatches.vue'
import { useStickySwatches } from '@/components/figjam/sticky/swatches'
import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/figjam/toolbar'

import TextTools from './TextTools.vue'
import ToolbarMenu from './ToolbarMenu.vue'

/** FigJam's sticky note toolbar: its ten colours, its text menus, and its author line. */
const sticky = useStickyNote()
const figjam = useFigJamMessages()
const { panels } = useI18n()
const styles = tv(theme)()
const { swatches, selected } = useStickySwatches(() => sticky.color.value)
const hex = computed(() => swatches.value.find((swatch) => swatch.value === selected.value)?.hex)
</script>

<template>
  <ToolbarMenu :label="figjam.changeColor" property="toolbar-color">
    <template #trigger>
      <span :class="styles.dot()" :style="{ backgroundColor: hex }" />
    </template>
    <FigJamSwatches
      :label="panels.stickyColor"
      :swatches="swatches"
      :selected="selected"
      @select="sticky.setColor(STICKY_COLORS[$event])"
    />
  </ToolbarMenu>
  <span :class="styles.divider()" />
  <TextTools />
  <IconButton
    size="md"
    toggle
    :label="panels.stickyShowAuthor"
    :active="sticky.authorVisible.value"
    data-property="toolbar-author"
    @click="sticky.setAuthorVisible(!sticky.authorVisible.value)"
  >
    <icon-lucide-user-round class="size-4" />
  </IconButton>
</template>
