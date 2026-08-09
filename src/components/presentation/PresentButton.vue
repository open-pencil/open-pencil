<script setup lang="ts">
import { computed, ref } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'

import { documentKindRules } from '@open-pencil/core/editor'
import {
  editorCommandMetadata,
  formatShortcut,
  useEditorCommands,
  useI18n,
  useViewportKind
} from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import presentationTheme from '@/theme/presentation'

const store = useEditorStore()
const { getCommand } = useEditorCommands()
const { commands, dialogs } = useI18n()
const { isMobile } = useViewportKind()
const styles = tv(presentationTheme)()

const open = ref(false)

const presentable = computed(
  () => documentKindRules(store.state.documentKind).presentable && !isMobile.value
)

/**
 * Shortcuts are rendered from command metadata rather than written into the labels —
 * translations must not carry shortcut text, and steiger enforces it.
 */
const modes = computed(() => [
  {
    id: 'view.present' as EditorCommandId,
    title: commands.value.present,
    shortcut: formatShortcut(editorCommandMetadata('view.present').shortcut) ?? '',
    description: dialogs.value.presentSoloDescription,
    testId: 'present-mode-solo'
  },
  {
    id: 'view.presentWithNotes' as EditorCommandId,
    title: commands.value.presentWithNotes,
    shortcut: formatShortcut(editorCommandMetadata('view.presentWithNotes').shortcut) ?? '',
    description: dialogs.value.presentWithNotesDescription,
    testId: 'present-mode-notes'
  }
])

function choose(id: EditorCommandId) {
  open.value = false
  getCommand(id).run()
}
</script>

<template>
  <PopoverRoot v-if="presentable" v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        data-test-id="present-button"
        :class="styles.presentButton()"
        :aria-label="commands.present"
      >
        <icon-lucide-play class="size-3.5" />
        <span>{{ commands.present }}</span>
      </button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="end"
        :side-offset="6"
        :class="styles.pickerContent()"
        data-test-id="present-picker"
      >
        <button
          v-for="mode in modes"
          :key="mode.id"
          type="button"
          :data-test-id="mode.testId"
          :class="styles.pickerOption()"
          @click="choose(mode.id)"
        >
          <!--
            One screen for a solo presentation, two for the split. Built from elements so
            it stays in step with the theme and needs no asset.
          -->
          <span :class="styles.pickerPreview()">
            <span :class="styles.pickerScreen()" class="h-12 w-20" />
            <span
              v-if="mode.id === 'view.presentWithNotes'"
              :class="styles.pickerScreen()"
              class="absolute right-6 bottom-4 h-9 w-14 bg-panel"
            />
          </span>
          <span :class="styles.pickerTitle()">{{ mode.title }}</span>
          <span v-if="mode.shortcut" :class="styles.pickerShortcut()">{{ mode.shortcut }}</span>
          <span :class="styles.pickerDescription()">{{ mode.description }}</span>
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
