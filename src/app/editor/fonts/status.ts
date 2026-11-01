import { computed, ref } from 'vue'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { DocumentFontUses, fontManager, fontResolver } from '@open-pencil/core/text'
import { useEditorEvent } from '@open-pencil/vue/editor/events'

import { useEditorStore } from '@/app/editor/active-store'
import { loadFont, requestLocalFontAccess } from '@/app/editor/fonts'

export function useDocumentFontStatus() {
  const editor = useEditorStore()
  const revision = ref(0)
  const retrying = ref(false)

  // The page's text faces, kept by layer: a keystroke updates one layer rather than walking
  // a page of tens of thousands of layers again.
  let uses = new DocumentFontUses(editor.graph, editor.state.currentPageId)

  const refresh = () => {
    revision.value++
  }
  const rebuild = () => {
    uses = new DocumentFontUses(editor.graph, editor.state.currentPageId)
    refresh()
  }
  const updateNode = (nodeId: string) => {
    uses.update(nodeId)
    refresh()
  }

  useEditorEvent('font:resolution-changed', refresh)
  // Fonts a paste or script loads reach no resolver, so their arrival refreshes the status too.
  useEditorEvent('font:loaded', refresh)
  useEditorEvent('graph:replaced', rebuild)
  useEditorEvent('page:changed', rebuild)
  useEditorEvent('node:created', (node) => updateNode(node.id))
  useEditorEvent('node:updated', updateNode)
  useEditorEvent('node:reparented', updateNode)
  useEditorEvent('node:reordered', updateNode)
  useEditorEvent('node:deleted', (nodeId) => {
    uses.remove(nodeId)
    refresh()
  })

  const status = computed(() => {
    void revision.value
    return uses.status()
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
