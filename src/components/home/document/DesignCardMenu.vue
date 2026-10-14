<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import { useMenuUI } from '@/components/ui/menu/menu'

/** Figma's right-click menu on a file in Recents or the trash. */
const {
  trashed = false,
  deck = false,
  conflicted = false
} = defineProps<{
  /** The design is in the trash, so it can be restored or permanently deleted. */
  trashed?: boolean
  /** A slide deck: it cannot be opened here, but its file can be downloaded. */
  deck?: boolean
  /** Changed on another device too, and not yet kept as both versions. */
  conflicted?: boolean
}>()
const emit = defineEmits<{
  open: []
  trash: []
  restore: []
  delete: []
  'download-deck': []
  'keep-copy': []
  'use-remote': []
  duplicate: []
  rename: []
}>()

const { files } = useI18n()

// Rename puts the focus in the card's name field. The menu holds the focus until it has closed,
// so the field appears only then, and the menu does not hand the focus back to the card.
let renamePending = false
function startRename() {
  renamePending = true
}
function onCloseAutoFocus(event: Event) {
  if (!renamePending) return
  renamePending = false
  event.preventDefault()
  emit('rename')
}
const menu = useMenuUI({ content: 'w-56', item: 'justify-start' })
const dangerItem = useMenuUI({ item: 'justify-start text-error' }).item
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        :class="menu.content"
        data-test-id="home-design-menu"
        @close-auto-focus="onCloseAutoFocus"
      >
        <template v-if="trashed">
          <ContextMenuItem :class="menu.item" @select="emit('restore')">
            {{ files.restore }}
          </ContextMenuItem>
          <ContextMenuItem :class="dangerItem" @select="emit('delete')">
            {{ files.deletePermanently }}
          </ContextMenuItem>
        </template>
        <template v-else>
          <ContextMenuItem :class="menu.item" @select="emit('open')">
            {{ files.open }}
          </ContextMenuItem>
          <ContextMenuItem v-if="deck" :class="menu.item" @select="emit('download-deck')">
            {{ files.downloadDeck }}
          </ContextMenuItem>
          <template v-if="conflicted">
            <ContextMenuSeparator :class="menu.separator" />
            <ContextMenuItem :class="menu.item" @select="emit('keep-copy')">
              {{ files.keepMyVersionAsCopy }}
            </ContextMenuItem>
            <ContextMenuItem :class="menu.item" @select="emit('use-remote')">
              {{ files.useOtherDeviceVersion }}
            </ContextMenuItem>
          </template>
          <ContextMenuSeparator :class="menu.separator" />
          <ContextMenuItem v-if="!deck" :class="menu.item" @select="emit('duplicate')">
            {{ files.duplicate }}
          </ContextMenuItem>
          <ContextMenuItem :class="menu.item" @select="startRename">
            {{ files.rename }}
          </ContextMenuItem>
          <ContextMenuSeparator :class="menu.separator" />
          <ContextMenuItem :class="menu.item" @select="emit('trash')">
            {{ files.moveToTrash }}
          </ContextMenuItem>
        </template>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
