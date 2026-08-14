import { computed, ref } from 'vue'

import type { EditorStore } from '@/app/editor/session'
import type { LibraryService } from '@/app/libraries'

export function useLibraryEntry(editor: EditorStore, service: LibraryService) {
  const open = ref(false)
  const initialSection = ref<'browse' | 'updates'>('browse')
  const updateCount = computed(() => {
    const outdatedBindings = service.summaries.value.filter((summary) => {
      const binding = editor.graph.enabledLibraries.get(summary.libraryId)
      return binding?.enabled && binding.revisionId !== summary.latestRevisionId
    }).length
    return Math.max(outdatedBindings, service.updates.value.length)
  })

  function openManager() {
    initialSection.value = updateCount.value > 0 ? 'updates' : 'browse'
    open.value = true
  }

  return { open, initialSection, updateCount, openManager }
}
