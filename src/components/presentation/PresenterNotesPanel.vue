<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { getSlideSpeakerNotes } from '@open-pencil/deck'
import { usePageList, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import presentationTheme from '@/theme/presentation'

/**
 * The presenter's notes for the slide on the audience screen.
 *
 * Read-only, and carrying no controls of its own: nothing in this window is editable while
 * presenting, and leaving the mode is the presenter bar's job.
 */
const store = useEditorStore()
const { currentPageId } = usePageList()
const { dialogs } = useI18n()
const styles = tv(presentationTheme)()

const page = computed(() => store.graph.getNode(currentPageId.value))
const notes = computed(() => getSlideSpeakerNotes(page.value).trim())
</script>

<template>
  <div :class="styles.presenterPanel()" data-test-id="presenter-notes-panel">
    <div :class="styles.presenterPanelBody()">
      <p v-if="notes" data-test-id="presenter-notes-text" :class="styles.presenterNotesText()">
        {{ notes }}
      </p>
      <p v-else data-test-id="presenter-notes-empty" :class="styles.presenterNotesEmpty()">
        {{ dialogs.noNotesForSlide }}
      </p>
    </div>
  </div>
</template>
