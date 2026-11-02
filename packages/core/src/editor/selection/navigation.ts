import { generatedFrameOwner, isGeneratedFrame } from '@open-pencil/scene-graph/generated'

import type { EditorContext } from '#core/editor/types'

type Select = (ids: string[]) => void

/** Figma's keyboard moves through the layer tree: Enter, Shift+Enter, Tab, and Shift+Tab. */
export function createSelectionNavigationActions(ctx: EditorContext, select: Select) {
  function selectedNodes() {
    return [...ctx.state.selectedIds].flatMap((id) => {
      const node = ctx.graph.getNode(id)
      return node ? [node] : []
    })
  }

  /**
   * Selects the children of every selected layer that has any; a selection without any stays.
   * A generated frame, such as a sticky note, has none to offer: its template owns its layers.
   */
  function selectChildren() {
    const children = selectedNodes().flatMap((node) =>
      isGeneratedFrame(node) ? [] : node.childIds
    )
    if (children.length > 0) select(children)
  }

  /** Selects the parents of the selected layers; layers directly on the page stay selected. */
  function selectParent() {
    const nodes = selectedNodes()
    const parents = nodes.map((node) => {
      const parent = node.parentId ? ctx.graph.getNode(node.parentId) : undefined
      return parent && parent.type !== 'CANVAS' ? parent.id : node.id
    })
    if (parents.some((id, index) => id !== nodes[index].id)) select(parents)
  }

  /**
   * Moves each selected layer to its sibling, wrapping at the ends. Next goes down the layers
   * panel, which lists the topmost layer first, so it steps back through the children.
   */
  function selectSibling(step: 1 | -1) {
    const nodes = selectedNodes()
    if (nodes.length === 0) return
    select(
      nodes.map((node) => {
        if (generatedFrameOwner(ctx.graph, node)) return node.id
        const siblings = node.parentId ? (ctx.graph.getNode(node.parentId)?.childIds ?? []) : []
        const index = siblings.indexOf(node.id)
        if (index === -1) return node.id
        return siblings[(index - step + siblings.length) % siblings.length]
      })
    )
  }

  return {
    selectChildren,
    selectParent,
    selectNextSibling: () => selectSibling(1),
    selectPreviousSibling: () => selectSibling(-1)
  }
}
