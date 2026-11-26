import { omit } from 'es-toolkit/object'
import { isEmptyObject } from 'es-toolkit/predicate'

import type { SceneGraph } from '../graph'
import { isTextStyleField, SHARED_TEXT_STYLE_FIELDS } from '../shared-styles'
import type { SceneNode, StyleRun } from '../types'

export type VariableBindings = Readonly<Record<string, string>>

/** What the text style with an ID binds, or undefined when the document does not hold it. */
export type TextStyleLookup = (styleId: string) => VariableBindings | undefined

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
  const boundByStyle = new Map<string, VariableBindings | undefined>()
  return (styleId) => {
    if (!boundByStyle.has(styleId)) {
      const style = graph.getSharedStyleNode(styleId, 'TEXT')
      boundByStyle.set(styleId, style && textStyleBoundVariables(style))
    }
    return boundByStyle.get(styleId)
  }
}

/**
 * The bindings a text or range holds itself that are in effect. While it uses a text style the
 * document holds, its own bindings of the style's fields wait, as in Figma, which draws the
 * style's values and saves those bindings back unchanged.
 */
function ownBindingsInEffect(
  own: VariableBindings,
  styleId: string | null | undefined,
  styles: TextStyleLookup
): VariableBindings {
  const waiting = styleId && styles(styleId) ? Object.keys(own).filter(isTextStyleField) : []
  return waiting.length === 0 ? own : omit(own, waiting)
}

function bindingsOf(styleId: string | null | undefined, styles: TextStyleLookup): VariableBindings {
  return (styleId && styles(styleId)) || NO_BINDINGS
}

type StyledLayer = Pick<SceneNode, 'type' | 'textStyleId' | 'boundVariables'>

/** A layer's own bindings in effect: all but a styled text's bindings of its style's fields. */
export function layerBindingsInEffect(
  node: StyledLayer,
  styles: TextStyleLookup
): VariableBindings {
  return node.type === 'TEXT'
    ? ownBindingsInEffect(node.boundVariables, node.textStyleId, styles)
    : node.boundVariables
}

function runBindingsInEffect(run: StyleRun, styles: TextStyleLookup): VariableBindings {
  const own = run.style.boundVariables ?? NO_BINDINGS
  return ownBindingsInEffect(own, run.style.textStyleId, styles)
}

/** What a text's style binds. */
export function inheritedTextStyleBindings(
  node: StyledLayer,
  styles: TextStyleLookup
): VariableBindings {
  if (node.type !== 'TEXT') {
    return NO_BINDINGS
  }
  return bindingsOf(node.textStyleId, styles)
}

/** What the style of a range of characters binds. */
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

/** The bindings a layer follows: its own in effect and those of its text style. */
export function effectiveBoundVariables(
  node: StyledLayer,
  styles: TextStyleLookup
): VariableBindings {
  return withInherited(
    layerBindingsInEffect(node, styles),
    inheritedTextStyleBindings(node, styles)
  )
}

/** The bindings a range of characters follows: its own in effect and those of its style. */
export function effectiveRunBoundVariables(
  run: StyleRun,
  styles: TextStyleLookup
): VariableBindings {
  return withInherited(runBindingsInEffect(run, styles), inheritedRunStyleBindings(run, styles))
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
