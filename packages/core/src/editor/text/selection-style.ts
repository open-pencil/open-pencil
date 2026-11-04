import { omit, pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import type { CharacterStyleOverride, SceneNode, StyleRun } from '@open-pencil/scene-graph'

import type { EditorContext } from '#core/editor/types'
import {
  characterStyles,
  layerTextStyleChanges,
  shownTextStyle,
  styleRunsWithPatch,
  TEXT_STYLE_KEYS,
  type TextStyleKey
} from '#core/text/character-style'

type NodeUpdate = (id: string, changes: Partial<SceneNode>) => void

function styleKeys(changes: Partial<SceneNode>): TextStyleKey[] {
  return TEXT_STYLE_KEYS.filter((key) => Object.hasOwn(changes, key))
}

/**
 * While text is edited with characters selected, a property its characters can each have, such
 * as a fill or font size, styles the selected characters instead of the layer, as in Figma. A
 * change that applies a text style still applies to the layer.
 */
export function createTextSelectionStyle(
  ctx: EditorContext,
  runTextEditStep: (change: () => void) => void
) {
  /**
   * The style runs a previewed change started from, which its commit records as undone to, and
   * the runs it last left; anything else changing them since ends the preview.
   */
  let preview: { nodeId: string; start: StyleRun[]; shown: StyleRun[] } | null = null

  function previewOf(id: string) {
    const node = ctx.graph.getNode(id)
    // Graph values are replaced rather than written into, so the runs it left are still its own.
    return preview?.nodeId === id && node?.styleRuns === preview.shown ? preview : null
  }

  function selectedRange(id: string): [number, number] | null {
    if (ctx.state.editingTextId !== id) return null
    return ctx.getTextEditor()?.getSelectionRange() ?? null
  }

  function rangeChanges(id: string, changes: Partial<SceneNode>): Partial<SceneNode> | null {
    const range = selectedRange(id)
    const node = ctx.graph.getNode(id)
    const keys = styleKeys(changes)
    if (!range || !node || keys.length === 0 || Object.hasOwn(changes, 'textStyleId')) return null
    const patch = pick(changes, keys) as CharacterStyleOverride
    return { ...omit(changes, keys), styleRuns: styleRunsWithPatch(node, ...range, patch) }
  }

  /** A change shown before it is committed, such as a dragged field. */
  function updateNode(id: string, changes: Partial<SceneNode>, update: NodeUpdate) {
    const ranged = rangeChanges(id, changes)
    if (!ranged) {
      update(id, changes)
      return
    }
    const current = previewOf(id)
    let start = current?.start ?? []
    // What was typed becomes a step of its own before the preview starts.
    if (!current) {
      runTextEditStep(() => {
        start = structuredClone(ctx.graph.getNode(id)?.styleRuns ?? [])
      })
    }
    update(id, ranged)
    preview = { nodeId: id, start, shown: ctx.graph.getNode(id)?.styleRuns ?? [] }
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, update: NodeUpdate) {
    const ranged = rangeChanges(id, changes)
    if (!ranged) {
      update(id, changes)
      return
    }
    preview = null
    runTextEditStep(() => update(id, ranged))
  }

  /**
   * Records a previewed change, given the values it replaced. The selected characters had
   * styles of their own, so the step undoes to the runs the preview started from.
   */
  function commitNodeUpdate(
    id: string,
    previous: Partial<SceneNode>,
    commit: NodeUpdate,
    updateWithUndo: NodeUpdate
  ) {
    const current = previewOf(id)
    const keys = styleKeys(previous)
    preview = null
    if (!current || keys.length === 0) {
      commit(id, previous)
      return
    }
    const previewed = current.shown
    // Back to where the preview started, so the edit session records nothing of its own.
    ctx.graph.updateNode(id, { styleRuns: current.start })
    runTextEditStep(() => {
      if (!isEqual(previewed, current.start)) updateWithUndo(id, { styleRuns: previewed })
      commit(id, omit(previous, keys))
    })
  }

  /**
   * The style of the selected characters as the layer's own properties, for the panel to show;
   * characters styled differently show the first one's. A text not being edited shows its first
   * character's, so a style its ranges set shows instead of one they hide.
   */
  function selectionStyle(node: SceneNode): Partial<SceneNode> | null {
    const range = selectedRange(node.id)
    if (!range) return shownTextStyle(node)
    const [style] = characterStyles(node, range[0], range[0] + 1)
    // Links, styles, and bindings of characters are not the layer's own properties.
    return pick(style, TEXT_STYLE_KEYS)
  }

  /**
   * A change the panel makes to a layer: on a text not being edited, a style it sets applies to
   * every character, so a range styled on its own no longer hides it. While text is edited the
   * change goes to the selected characters, as `updateNode` sends it.
   */
  function layerChanges(id: string, changes: Partial<SceneNode>): Partial<SceneNode> {
    const node = ctx.graph.getNode(id)
    if (!node || ctx.state.editingTextId === id) return changes
    return layerTextStyleChanges(node, changes)
  }

  return { updateNode, updateNodeWithUndo, commitNodeUpdate, selectionStyle, layerChanges }
}
