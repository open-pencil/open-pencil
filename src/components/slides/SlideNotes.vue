<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { resolveEditorProfile } from '@open-pencil/core'
import { slideSettings } from '@open-pencil/scene-graph/slides'
import { useMessages } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import { useEditorStore } from '@/app/editor/active-store'
import slideNotesTheme from '@/theme/slides/notes'

/**
 * The speaker notes of the slide on the stage, or of the one slide selected in the grid. Typing
 * changes nothing until the field is left, so a pause in typing is not an undo step of its own.
 */
const store = useEditorStore()
const messages = useMessages('slides')
const styles = tv(slideNotesTheme)()

const slideId = useSceneComputed(() => {
  const staged = store.state.focusedSlideId
  if (staged) return staged
  const [only, ...rest] = store.state.selectedIds
  return only && rest.length === 0 && store.graph.getNode(only)?.type === 'SLIDE' ? only : null
})
const saved = useSceneComputed(() => {
  const node = slideId.value ? store.graph.getNode(slideId.value) : undefined
  return (node && slideSettings(node)?.notes) ?? ''
})
const editable = computed(() => {
  const profile = resolveEditorProfile(store.state)
  return profile.edits && profile.layerEdits === 'all'
})

const draft = ref(saved.value)
const typing = ref(false)
watch(saved, (notes) => {
  if (!typing.value) draft.value = notes
})

function commit(id: string | null) {
  typing.value = false
  if (id) store.setSlideNotes(id, draft.value)
}
// Moving to another slide while typing keeps what was typed on the slide it was typed for.
watch(slideId, (_, previous) => {
  if (typing.value) commit(previous)
  draft.value = saved.value
})

// Hiding the panels can take the field away without a blur: what was typed is kept even so.
onBeforeUnmount(() => {
  if (typing.value) commit(slideId.value)
})

function revert(event: KeyboardEvent) {
  typing.value = false
  draft.value = saved.value
  if (event.target instanceof HTMLElement) event.target.blur()
}
</script>

<template>
  <section data-test-id="slide-notes" :class="styles.root()" :aria-label="messages.notes">
    <h2 :class="styles.label()">{{ messages.notes }}</h2>
    <textarea
      v-if="slideId"
      v-model="draft"
      data-test-id="slide-notes-field"
      :class="styles.field()"
      :aria-label="messages.notes"
      :placeholder="messages.notesPlaceholder"
      :readonly="!editable"
      spellcheck="true"
      @input="typing = true"
      @blur="commit(slideId)"
      @keydown.escape.stop="revert"
    />
    <p v-else :class="styles.empty()">{{ messages.notesPickSlide }}</p>
  </section>
</template>
