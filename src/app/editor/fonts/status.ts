import { computed, ref } from 'vue'

import { documentFontStatus, fontManager, fontResolver } from '@open-pencil/core/text'
import { useEditor, useEditorEvent } from '@open-pencil/vue'

import { loadFont, requestLocalFontAccess } from '@/app/editor/fonts'

export function useDocumentFontStatus() {
  const editor = useEditor()
  const revision = ref(0)
  const retrying = ref(false)

  const refresh = () => {
    revision.value++
  }

  useEditorEvent('font:resolution-changed', refresh)
  useEditorEvent('graph:replaced', refresh)
  useEditorEvent('page:changed', refresh)
  useEditorEvent('node:created', refresh)
  useEditorEvent('node:updated', refresh)
  useEditorEvent('node:deleted', refresh)

  const status = computed(() => {
    void revision.value
    return documentFontStatus(editor.graph, editor.state.currentPageId)
  })

  async function retry() {
    if (retrying.value) return
    retrying.value = true
    try {
      if (fontManager.localAccessState() === 'prompt') {
        await requestLocalFontAccess().catch(() => [])
      }
      const issues = status.value.issues
      await Promise.all(
        issues.map(async ({ family, style }) => {
          fontResolver.reset(
            `face:${family.trim().toLocaleLowerCase()}:${style.toLocaleLowerCase()}`
          )
          await loadFont(family, style)
        })
      )
      editor.requestRender()
      refresh()
    } finally {
      retrying.value = false
    }
  }

  function selectAffectedNodes() {
    editor.select(status.value.issues.flatMap((issue) => issue.nodeIds))
  }

  return { status, retrying, retry, selectAffectedNodes }
}
