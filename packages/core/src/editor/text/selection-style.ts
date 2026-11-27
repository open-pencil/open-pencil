import { omit, pick } from 'es-toolkit/object'
import { isEqual } from 'es-toolkit/predicate'

import {
  TEXT_BINDABLE_FIELDS,
  type CharacterStyleOverride,
  type SceneNode,
  type StyleRun,
  type TextBindableField
} from '@open-pencil/scene-graph'
import { paintBindingTarget } from '@open-pencil/scene-graph/variables'

import type { EditorContext } from '#core/editor/types'
import { rangeBindingChanges, rangeSharedStylePatch } from '#core/figma-api/text/bindings'
import { rangePaintBindingRuns } from '#core/text/character/bindings'
import {
  characterStyles,
  layerTextStyleChanges,
  shownTextStyle,
  styleRunsWithPatch,
  TEXT_STYLE_KEYS,
  type CharacterStyle,
  type TextStyleKey
} from '#core/text/character/style'

type NodeUpdate = (id: string, changes: Partial<SceneNode>) => void

function styleKeys(changes: Partial<SceneNode>): TextStyleKey[] {
  return TEXT_STYLE_KEYS.filter((key) => Object.hasOwn(changes, key))
}

/**
 * Text fields a selection binds on its own characters. Paragraph spacing and indent stay the
 * layer's: they belong to whole paragraphs, which the panel sets for the text.
 */
const RANGE_BINDABLE_FIELDS: ReadonlySet<string> = new Set(
  TEXT_BINDABLE_FIELDS.filter(
    (field) => field !== 'paragraphSpacing' && field !== 'paragraphIndent'
  )
)

function isRangeBindable(field: string): field is TextBindableField {
  return RANGE_BINDABLE_FIELDS.has(field)
}

/** The shared style a change applies or detaches, if any. */
function sharedStyleChange(changes: Partial<SceneNode>): 'text' | 'fill' | null {
  if (Object.hasOwn(changes, 'textStyleId')) return 'text'
  if (Object.hasOwn(changes, 'fillStyleId')) return 'fill'
  return null
}

/** The bindings characters keep of their own: text fields and their own fills' colours. */
function characterOwnBindings(bound: Readonly<Record<string, string>>): Record<string, string> {
  const own: Record<string, string> = {}
  for (const [field, variableId] of Object.entries(bound)) {
    const textField = (TEXT_BINDABLE_FIELDS as readonly string[]).includes(field)
    if (textField || paintBindingTarget(field)?.list === 'fills') own[field] = variableId
  }
  return own
}

/**
 * The bindings the panel shows for characters: the layer's, with the text fields the characters
 * bind in place of the layer's, and the colours of fills the characters have of their own.
 */
function characterBindings(node: SceneNode, style: CharacterStyle): Record<string, string> {
  const ownFills = style.fills !== node.fills
  const replaced = Object.keys(node.boundVariables).filter(
    (field) =>
      (TEXT_BINDABLE_FIELDS as readonly string[]).includes(field) ||
      (ownFills && paintBindingTarget(field)?.list === 'fills')
  )
  return { ...omit(node.boundVariables, replaced), ...style.boundVariables }
}

/**
 * While text is edited with characters selected, a property its characters can each have, such
 * as a fill or font size, styles the selected characters instead of the layer, as in Figma, and
 * so do the text and fill styles applied and the variables bound to those properties.
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
    // A change that writes the runs itself, such as a cancelled preview put back, is the text's.
    if (!range || !node || Object.hasOwn(changes, 'styleRuns')) return null
    const kind = sharedStyleChange(changes)
    if (kind) return rangeStyleChanges(node, range, kind, changes)
    const keys = styleKeys(changes)
    if (keys.length === 0) return null
    const patch = pick(changes, keys) as CharacterStyleOverride
    let layer = omit(changes, keys)
    // A fill list edited on the selection takes the bindings its paints moved with, which are
    // the characters' own: the layer keeps its own.
    if (patch.fills && changes.boundVariables) {
      const own = characterOwnBindings(changes.boundVariables)
      patch.boundVariables = Object.keys(own).length > 0 ? own : undefined
      layer = omit(layer, ['boundVariables'])
    }
    return { ...layer, styleRuns: styleRunsWithPatch(node, ...range, patch) }
  }

  /**
   * A text or fill style applied to the selected characters, or detached from them, as Figma
   * applies one to a range: with the style's values, and its reference, on those characters only.
   */
  function rangeStyleChanges(
    node: SceneNode,
    range: [number, number],
    kind: 'text' | 'fill',
    changes: Partial<SceneNode>
  ): Partial<SceneNode> | null {
    const styleId = (kind === 'text' ? changes.textStyleId : changes.fillStyleId) ?? ''
    const patch = rangeSharedStylePatch(ctx.graph, node, kind, styleId)
    if (!patch) return null
    const applied: (keyof SceneNode)[] =
      kind === 'text' ? ['textStyleId', ...styleKeys(changes)] : ['fillStyleId', 'fills']
    return { ...omit(changes, applied), styleRuns: styleRunsWithPatch(node, ...range, patch) }
  }

  /**
   * Binds a field of the selected characters to a variable, or unbinds it with `null`: a text
   * field, or the colour of one of their fills, as Figma binds a range's. False when nothing is
   * selected or the field is the layer's, which the caller then binds on the layer.
   */
  function bindSelection(
    id: string,
    field: string,
    variableId: string | null,
    update: NodeUpdate
  ): boolean {
    const range = selectedRange(id)
    const node = ctx.graph.getNode(id)
    if (!range || !node) return false
    const paint = paintBindingTarget(field)
    let styleRuns: StyleRun[]
    if (isRangeBindable(field)) {
      const variable = variableId ? { id: variableId } : null
      styleRuns = rangeBindingChanges(ctx.graph, node, ...range, field, variable).styleRuns
    } else if (paint?.list === 'fills') {
      styleRuns = rangePaintBindingRuns(ctx.graph, node, ...range, paint.index, variableId)
    } else {
      return false
    }
    preview = null
    runTextEditStep(() => update(id, { styleRuns }))
    return true
  }

  /** The variable a field of a layer is bound to, as the panel shows it: its selection's, if any. */
  function boundVariable(node: SceneNode, field: string): string | undefined {
    const range = selectedRange(node.id)
    if (!range) return node.boundVariables[field]
    const [style] = characterStyles(node, range[0], range[0] + 1)
    return characterBindings(node, style)[field]
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
   * The style of the selected characters as the layer's own properties, for the panel to show,
   * with the text and fill styles they use and the variables they bind; characters styled
   * differently show the first one's. A text not being edited shows its first character's, so a
   * style its ranges set shows instead of one they hide.
   */
  function selectionStyle(node: SceneNode): Partial<SceneNode> | null {
    const range = selectedRange(node.id)
    if (!range) return shownTextStyle(node)
    const [style] = characterStyles(node, range[0], range[0] + 1)
    return {
      ...pick(style, TEXT_STYLE_KEYS),
      textStyleId: style.textStyleId,
      fillStyleId: style.fillStyleId,
      boundVariables: characterBindings(node, style)
    }
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

  return {
    updateNode,
    updateNodeWithUndo,
    commitNodeUpdate,
    selectionStyle,
    layerChanges,
    bindSelection,
    boundVariable
  }
}
