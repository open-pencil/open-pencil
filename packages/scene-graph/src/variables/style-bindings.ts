import { omit } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import type { SceneGraph } from '../graph'
import { SHARED_TEXT_STYLE_FIELDS } from '../shared-styles'
import type { SceneNode, StyleRun } from '../types'

export type VariableBindings = Readonly<Record<string, string>>

export type TextStyleLookup = (styleId: string) => VariableBindings

const TEXT_STYLE_FIELDS: ReadonlySet<string> = new Set(SHARED_TEXT_STYLE_FIELDS)

const NO_BINDINGS: VariableBindings = Object.freeze({})

export function textStyleBoundVariables(style: SceneNode): VariableBindings {
  let bound: Record<string, string> | undefined
  for (const field in style.boundVariables) {
    if (TEXT_STYLE_FIELDS.has(field)) {
      bound ??= {}
      bound[field] = style.boundVariables[field]
    }
  }
  return bound ?? NO_BINDINGS
}

export function createStyleBindingLookup(graph: SceneGraph): TextStyleLookup {
  const boundByStyle = new Map<string, VariableBindings>()
  return (styleId) => {
    let bound = boundByStyle.get(styleId)
    if (!bound) {
      const style = graph.getSharedStyleNode(styleId, 'TEXT')
      bound = style ? textStyleBoundVariables(style) : NO_BINDINGS
      boundByStyle.set(styleId, bound)
    }
    return bound
  }
}

/**
 * The layer's own bindings its text style does not take over. While the style is attached, a
 * field the style binds follows the style's variable, as in Figma; the layer keeps its own
 * binding stored, so a document saves it back unchanged.
 */
export function bindingsNotTakenOver(
  own: VariableBindings,
  styleBound: VariableBindings
): VariableBindings {
  if (styleBound === NO_BINDINGS) {
    return own
  }
  let takenOver = false
  for (const field in own) {
    if (field in styleBound) {
      takenOver = true
      break
    }
  }
  return takenOver ? omit(own, Object.keys(styleBound)) : own
}

function bindingsOf(styleId: string | null | undefined, styles: TextStyleLookup): VariableBindings {
  return styleId ? styles(styleId) : NO_BINDINGS
}

type StyledLayer = Pick<SceneNode, 'type' | 'textStyleId' | 'boundVariables'>

/** What a text's style binds, which wins over the text's own bindings of the same fields. */
export function inheritedTextStyleBindings(
  node: StyledLayer,
  styles: TextStyleLookup
): VariableBindings {
  if (node.type !== 'TEXT') {
    return NO_BINDINGS
  }
  return bindingsOf(node.textStyleId, styles)
}

/** What the style of a range of characters binds, which wins over the range's own bindings. */
export function inheritedRunStyleBindings(
  run: StyleRun,
  styles: TextStyleLookup
): VariableBindings {
  return bindingsOf(run.style.textStyleId, styles)
}

function withInherited(own: VariableBindings, inherited: VariableBindings): VariableBindings {
  if (inherited === NO_BINDINGS) {
    return own
  }
  return isEmptyObject(own) ? inherited : { ...own, ...inherited }
}

export function effectiveBoundVariables(
  node: StyledLayer,
  styles: TextStyleLookup
): VariableBindings {
  return withInherited(node.boundVariables, inheritedTextStyleBindings(node, styles))
}

export function effectiveRunBoundVariables(
  run: StyleRun,
  styles: TextStyleLookup
): VariableBindings {
  const own = run.style.boundVariables ?? NO_BINDINGS
  return withInherited(own, inheritedRunStyleBindings(run, styles))
}

function usesTextStyleOf(node: SceneNode, styleIds: ReadonlySet<string>): boolean {
  if (node.textStyleId && styleIds.has(node.textStyleId)) {
    return true
  }
  return node.styleRuns.some((run) => {
    const styleId = run.style.textStyleId
    return Boolean(styleId && styleIds.has(styleId))
  })
}

export function textStyleConsumers(graph: SceneGraph, styleIds: ReadonlySet<string>): SceneNode[] {
  const consumers: SceneNode[] = []
  for (const node of graph.getAllNodes()) {
    if (!node.sharedStyleType && usesTextStyleOf(node, styleIds)) {
      consumers.push(node)
    }
  }
  return consumers
}
