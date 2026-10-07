import { computed, shallowRef, type Ref } from 'vue'

import {
  designJSXElement,
  selectionToJSXWithLayers,
  type DesignJSXElement
} from '@open-pencil/design-jsx'
import { useDesignCheckMessages } from '@open-pencil/vue'

import type { GeneratedCode } from '@/app/code/generated'
import type { DesignJSXLayerLine } from '@/app/code/live-preview'
import type { CodeSource } from '@/app/code/templates'
import { useEditorStore } from '@/app/editor/active-store'

import { codeLayerIssues } from './issues'
import type { LayerLinkSource } from './links'

/**
 * Connects the code in the Code tab to canvas layers: which layer each element produced, the
 * design issues to underline, and the layer marked for the element around the cursor.
 */
export function useCodeLayers(source: Readonly<Ref<CodeSource>>) {
  const store = useEditorStore()
  const messages = useDesignCheckMessages()
  const links = shallowRef<LayerLinkSource | null>(null)

  const issues = computed(() => {
    const snapshot = store.designCheck.snapshot.value
    if (!snapshot || snapshot.pageId !== store.state.currentPageId) return []
    return codeLayerIssues(snapshot.issues, source.value, messages.value)
  })

  /** Generated code lists its layers in element order. */
  function showGenerated(generated: GeneratedCode | null) {
    links.value = generated ? { kind: 'order', layerIds: generated.layerIds } : null
  }

  /** A live preview reports the line each rendered layer came from. */
  function showPreview(layers: readonly DesignJSXLayerLine[]) {
    links.value = { kind: 'lines', layers }
  }

  /** Marks the layer of the element around the cursor on the canvas, apart from hover. */
  function markActive(nodeIds: readonly string[] | null) {
    store.setCodeFocusNode(nodeIds?.find((id) => store.graph.getNode(id)) ?? null)
  }

  /** A linked layer as Design JSX writes it, the unit code is patched in. */
  function describe(nodeId: string): DesignJSXElement | null {
    return designJSXElement(nodeId, store.graph)
  }

  /** Design JSX for a layer added on the canvas, with the layer of each of its elements. */
  function snippet(nodeId: string): { code: string; layerIds: string[] } | null {
    const { code, layerIds } = selectionToJSXWithLayers([nodeId], store.graph)
    return code ? { code, layerIds } : null
  }

  return {
    links,
    issues,
    showGenerated,
    showPreview,
    markActive,
    describe,
    snippet
  }
}
