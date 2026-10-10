import { computed, ref } from 'vue'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { documentFontStatus, fontManager, fontResolver } from '@open-pencil/core/text'
import { useEditorEvent } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { loadFont, requestLocalFontAccess } from '@/app/editor/fonts'

export function useDocumentFontStatus() {
  const editor = useEditorStore()
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
    const preparation = editor.preparationController.begin({ kind: 'font-retry' })
    let succeeded = false
    try {
      if (fontManager.localAccessState() === 'prompt') {
        await requestLocalFontAccess().catch(() => [])
      }
      const issues = status.value.issues
      await Promise.all(
        issues.map(async ({ family, style }) => {
          fontManager.resetWebFontFailures(family, style)
          fontResolver.reset(
            `face:${family.trim().toLocaleLowerCase()}:${style.toLocaleLowerCase()}`
          )
          await loadFont(family, style, '', preparation.signal)
        })
      )
      editor.renderer?.invalidateAllPictures()
      editor.graph.applyDerivedLayoutDuring(() =>
        computeAllLayouts(editor.graph, editor.state.currentPageId)
      )
      preparation.update({ phase: 'preparing-render' })
      editor.requestRender()
      if (editor.renderer) {
        await editor.preparationController.waitForPresentation(
          preparation.id,
          editor.state.sceneVersion
        )
      }
      refresh()
      succeeded = true
    } catch (error) {
      if (!preparation.signal.aborted) {
        preparation.fail({
          code: 'font-failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: true
        })
      }
    } finally {
      if (succeeded) preparation.complete()
      retrying.value = false
    }
  }

  function selectAffectedNodes() {
    editor.select(status.value.issues.flatMap((issue) => issue.nodeIds))
  }

  return { status, retrying, retry, selectAffectedNodes }
}
