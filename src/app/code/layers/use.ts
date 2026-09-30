import { computed, shallowRef, type Ref } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import type { GeneratedCode } from '@/app/code/generated'
import type { DesignJSXLayerLine } from '@/app/code/live-preview'
import type { CodeSource } from '@/app/code/templates'
import { useEditorStore } from '@/app/editor/active-store'

import { codeLayerIssues } from './issues'
import type { LayerLinkSource } from './links'

/**
 * Connects the code in the Code tab to canvas layers: which layer each element produced, the
 * design issues to underline, and what hovering or ⌘-clicking an element does on the canvas.
 */
export function useCodeLayers(source: Readonly<Ref<CodeSource>>) {
  const store = useEditorStore()
  const messages = useDesignCheckMessages()
  const links = shallowRef<LayerLinkSource | null>(null)
  /** Links of the generated code, restored when an edit is reset. */
  let generatedLinks: LayerLinkSource | null = null

  const issues = computed(() => {
    const snapshot = store.designCheck.snapshot.value
    if (!snapshot || snapshot.pageId !== store.state.currentPageId) return []
    return codeLayerIssues(snapshot.issues, source.value, messages.value)
  })

  /** Generated code lists its layers in element order. */
  function showGenerated(generated: GeneratedCode | null) {
    generatedLinks = generated ? { kind: 'order', layerIds: generated.layerIds } : null
    links.value = generatedLinks
  }

  /** A live preview reports the line each rendered layer came from. */
  function showPreview(layers: readonly DesignJSXLayerLine[]) {
    links.value = { kind: 'lines', layers }
  }

  function restoreGenerated() {
    links.value = generatedLinks
  }

  function hover(nodeIds: readonly string[] | null) {
    store.setHoveredNode(nodeIds?.at(0) ?? null)
  }

  /** Brings the layers into view and flashes them without changing the selection the code shows. */
  function reveal(nodeIds: readonly string[]) {
    const present = nodeIds.filter((id) => store.graph.getNode(id))
    if (present.length === 0) return
    store.revealNodes(present)
    store.flashNodes(present)
  }

  return { links, issues, showGenerated, showPreview, restoreGenerated, hover, reveal }
}
