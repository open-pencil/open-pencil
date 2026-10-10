<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'
import { useTemplateRef, watchPostEffect, type Component } from 'vue'

import { useI18n } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'
import theme from '@/theme/settings/toolbar/row'

export type ToolbarRowControl = 'grip' | 'options'

/**
 * One toolbar entry. Drag it anywhere; its grip moves it with the arrow keys, and its options
 * move it or put it in or out of a flyout without a pointer.
 */
const {
  label,
  icon,
  shortcut,
  hidden,
  pinned,
  canMoveUp,
  canMoveDown,
  groupWith,
  inFlyout,
  dropTarget,
  focus
} = defineProps<{
  label: string
  icon: Component
  shortcut: string
  hidden: boolean
  /** Always shown, so its switch stays on. */
  pinned: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  /** The tool above that this row can share a flyout with. */
  groupWith?: string
  inFlyout: boolean
  /** Another row is about to be dropped onto this one. */
  dropTarget: boolean
  /** The control to focus, as after an edit put the row in another box. */
  focus: ToolbarRowControl | null
}>()

const emit = defineEmits<{
  /** `control` is the one used, which keeps focus once the row has moved. */
  move: [step: -1 | 1, control: ToolbarRowControl]
  group: []
  ungroup: []
  'update:shown': [shown: boolean]
  focused: []
}>()

const { settings } = useI18n()
const styles = tv(theme)
const menu = useMenuUI({ content: 'min-w-44', item: 'justify-start gap-2' })
const controls = {
  grip: useTemplateRef('grip'),
  options: useTemplateRef('options')
}

// Runs after render, so a control that just mounted, as when its row moved boxes, takes focus.
watchPostEffect(() => {
  const control = focus && controls[focus].value
  if (!control) return
  control.focus()
  emit('focused')
})

function onGripKey(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' && canMoveUp) emit('move', -1, 'grip')
  else if (event.key === 'ArrowDown' && canMoveDown) emit('move', 1, 'grip')
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
    <component :is="icon" :class="styles({ hidden }).icon()" aria-hidden="true" />
    <span :class="styles({ hidden }).label()">{{ label }}</span>
    <AppShortcutText :ui="{ base: styles().shortcut() }">{{ shortcut }}</AppShortcutText>
    <DropdownMenuRoot :modal="false">
      <DropdownMenuTrigger as-child>
        <IconButton
          ref="options"
          :class="styles().options()"
          :label="settings.toolbarOptions({ tool: label })"
        >
          <icon-lucide-ellipsis class="size-3.5" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <!-- The editor puts focus back on this row's options once the edit has rendered. -->
        <DropdownMenuContent
          :class="menu.content"
          align="end"
          :side-offset="4"
          @close-auto-focus.prevent
        >
          <DropdownMenuItem
            :class="menu.item"
            :disabled="!canMoveUp"
            @select="emit('move', -1, 'options')"
          >
            <icon-lucide-arrow-up :class="menu.icon" />
            {{ settings.toolbarMoveUp }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="menu.item"
            :disabled="!canMoveDown"
            @select="emit('move', 1, 'options')"
          >
            <icon-lucide-arrow-down :class="menu.icon" />
            {{ settings.toolbarMoveDown }}
          </DropdownMenuItem>
          <template v-if="groupWith || inFlyout">
            <DropdownMenuSeparator :class="menu.separator" />
            <DropdownMenuItem v-if="groupWith" :class="menu.item" @select="emit('group')">
              <icon-lucide-link-2 :class="menu.icon" />
              {{ settings.toolbarGroupWith({ tool: groupWith }) }}
            </DropdownMenuItem>
            <DropdownMenuItem v-if="inFlyout" :class="menu.item" @select="emit('ungroup')">
              <icon-lucide-unlink-2 :class="menu.icon" />
              {{ settings.toolbarUngroup }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <AppSwitch
      :model-value="!hidden"
      :disabled="pinned"
      :label="settings.toolbarShow({ tool: label })"
      @update:model-value="emit('update:shown', $event)"
    />
  </div>
</template>
