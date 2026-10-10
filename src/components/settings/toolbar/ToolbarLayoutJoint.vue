<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useTemplateRef, watchPostEffect } from 'vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import theme from '@/theme/settings/toolbar/joint'

/**
 * Where two rows meet. A dragged row lands here, and its link toggle puts the row below in a
 * flyout with the row above or takes it out.
 */
const {
  kind,
  linked = false,
  toggleLabel,
  dropping,
  focusToggle = false
} = defineProps<{
  kind: 'inside' | 'between' | 'end'
  linked?: boolean
  /** Names the toggle; without one the two rows cannot share a flyout. */
  toggleLabel?: string
  /** A dragged row would land here. */
  dropping: boolean
  focusToggle?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  focused: []
}>()

const styles = tv(theme)
const toggle = useTemplateRef('toggle')

// Runs after render, so a toggle that just mounted, as when its row moved boxes, takes focus too.
watchPostEffect(() => {
  if (!focusToggle || !toggle.value) return
  toggle.value.focus()
  emit('focused')
})
</script>

<template>
  <div :class="styles({ kind }).root()">
    <span v-if="dropping" :class="styles().line()" />
    <span v-if="toggleLabel" :class="styles().grip()">
      <IconButton
        ref="toggle"
        toggle
        :class="styles({ linked }).toggle()"
        :active="linked"
        :label="toggleLabel"
        @click="emit('toggle')"
      >
        <icon-lucide-link-2 class="size-3.5" />
      </IconButton>
    </span>
  </div>
</template>
