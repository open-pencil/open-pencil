<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'
import { useMessages } from '@open-pencil/vue/i18n'

import { useEditorStore } from '@/app/editor/active-store'
import { openPresenterWindow } from '@/app/editor/present/window'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppDropdownMenuRoot from '@/components/ui/menu/AppDropdownMenuRoot.vue'
import { menu } from '@/components/ui/menu/menu'

/**
 * Presents a deck from the slide on the stage or the one selected, or from its start; in a design,
 * presents the selected frames, or all of them, as slides.
 */
const store = useEditorStore()
const deck = computed(() => resolveEditorProfile(store.state).filmstrip)
const messages = useMessages('slides')
const menuUI = menu()

/** The slide being worked on: the one on the stage, else the first selected slide. */
function currentSlide(): string | null {
  if (store.state.focusedSlideId) return store.state.focusedSlideId
  for (const id of store.state.selectedIds) if (store.graph.getNode(id)?.type === 'SLIDE') return id
  return null
}

/** Presents with the presenter's window beside the deck. */
function presentWithNotes() {
  const started = deck.value ? store.present(currentSlide()) : store.presentFrames()
  if (!started) return
  const presentation = store.state.presentation
  if (presentation) openPresenterWindow(presentation.id, messages.value.presenterView)
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
        <template v-if="deck">
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
        </template>
        <DropdownMenuItem
          v-else
          :class="menuUI.item({ justify: 'start' })"
          data-test-id="slides-present-frames"
          @select="store.presentFrames()"
        >
          <icon-lucide-presentation :class="menuUI.icon()" />
          {{ messages.presentFrames }}
        </DropdownMenuItem>
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          data-test-id="slides-present-notes"
          @select="presentWithNotes"
        >
          <icon-lucide-notebook-text :class="menuUI.icon()" />
          {{ deck ? messages.presentWithNotes : messages.presentFramesWithNotes }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </AppDropdownMenuRoot>
</template>
