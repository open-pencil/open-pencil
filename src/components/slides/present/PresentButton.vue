<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger
} from 'reka-ui'

import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menu } from '@/components/ui/menu/menu'

/** Presents the deck from the slide on the stage or the one selected, or from its start. */
const store = useEditorStore()
const messages = useMessages('slides')
const menuUI = menu()

/** The slide being worked on: the one on the stage, else the first selected slide. */
function currentSlide(): string | null {
  if (store.state.focusedSlideId) return store.state.focusedSlideId
  for (const id of store.state.selectedIds) if (store.graph.getNode(id)?.type === 'SLIDE') return id
  return null
}
</script>

<template>
  <AppDropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <IconButton :label="messages.present" data-test-id="slides-present">
        <icon-lucide-presentation class="size-3.5" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent side="bottom" align="end" :side-offset="4" :class="menuUI.content()">
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          data-test-id="slides-present-current"
          @select="store.present(currentSlide())"
        >
          <icon-lucide-presentation :class="menuUI.icon()" />
          {{ messages.present }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          data-test-id="slides-present-start"
          @select="store.present()"
        >
          <icon-lucide-skip-back :class="menuUI.icon()" />
          {{ messages.presentFromStart }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </AppDropdownMenuRoot>
</template>
