<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { getSlideSpeakerNotes, setSlideSpeakerNotes } from '@open-pencil/deck'
import { useI18n, usePageList } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import notesPaneTheme from '@/theme/notes-pane'

const store = useEditorStore()
const { currentPageId } = usePageList()
const { dialogs } = useI18n()
const styles = tv(notesPaneTheme)()

const page = computed(() => store.graph.getNode(currentPageId.value))
const notes = computed(() => getSlideSpeakerNotes(page.value))

function onInput(event: Event) {
  const pageNode = page.value
  if (!pageNode) return
  const value = (event.target as HTMLTextAreaElement).value
  setSlideSpeakerNotes(pageNode, value)
  // Notes are page metadata, not scene-graph nodes: no undo entry, but the document must
  // be treated as modified so a save (or autosave) carries them into the deck.
  store.requestRender()
}
</script>

<template>
  <div data-test-id="notes-pane" :class="styles.panel()">
    <div :class="styles.header()">
      <span :class="styles.title()">{{ dialogs.presenterNotes }}</span>
    </div>
    <textarea
      data-test-id="notes-input"
      :class="styles.input()"
      :value="notes"
      :placeholder="dialogs.addPresenterNotes"
      spellcheck="false"
      @input="onInput"
    />
  </div>
</template>
