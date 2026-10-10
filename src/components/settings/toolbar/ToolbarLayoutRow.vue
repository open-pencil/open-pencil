<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useTemplateRef, watchPostEffect, type Component } from 'vue'

import { useI18n } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import theme from '@/theme/settings/toolbar/row'

/** One toolbar entry: drag it anywhere, or focus its grip and move it with the arrow keys. */
const { label, icon, shortcut, hidden, pinned, canMoveUp, canMoveDown, dropTarget, focusGrip } =
  defineProps<{
    label: string
    icon: Component
    shortcut: string
    hidden: boolean
    /** Always shown, so its switch stays on. */
    pinned: boolean
    canMoveUp: boolean
    canMoveDown: boolean
    /** Another row is about to be dropped onto this one. */
    dropTarget: boolean
    /** The grip takes focus, as after a move puts the row somewhere else. */
    focusGrip: boolean
  }>()

const emit = defineEmits<{
  move: [step: -1 | 1]
  'update:shown': [shown: boolean]
  focused: []
}>()

const { settings } = useI18n()
const styles = tv(theme)
const grip = useTemplateRef('grip')

// Runs after render, so a grip that just mounted, as when its row moved boxes, takes focus too.
watchPostEffect(() => {
  if (!focusGrip || !grip.value) return
  grip.value.focus()
  emit('focused')
})

function onGripKey(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' && canMoveUp) emit('move', -1)
  else if (event.key === 'ArrowDown' && canMoveDown) emit('move', 1)
  else return
  event.preventDefault()
}
</script>

<template>
  <div :class="styles().root()">
    <span v-if="dropTarget" :class="styles().target()" />
    <IconButton
      ref="grip"
      :class="styles().grip()"
      :label="settings.toolbarReorder({ tool: label })"
      aria-keyshortcuts="ArrowUp ArrowDown"
      @keydown="onGripKey"
    >
      <icon-lucide-grip-vertical class="size-3.5" />
    </IconButton>
    <span :class="styles().link()" aria-hidden="true" />
    <component :is="icon" :class="styles({ hidden }).icon()" aria-hidden="true" />
    <span :class="styles({ hidden }).label()">{{ label }}</span>
    <AppShortcutText :ui="{ base: styles().shortcut() }">{{ shortcut }}</AppShortcutText>
    <AppSwitch
      :model-value="!hidden"
      :disabled="pinned"
      :label="settings.toolbarShow({ tool: label })"
      @update:model-value="emit('update:shown', $event)"
    />
  </div>
</template>
