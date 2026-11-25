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

export function createTextStyleLookup(graph: SceneGraph): TextStyleLookup {
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

function notOverridden(styleBound: VariableBindings, own: VariableBindings): VariableBindings {
  let overridden = false
  for (const field in styleBound) {
    if (field in own) {
      overridden = true
      break
    }
  }
  if (!overridden) {
    return styleBound
  }
  const inherited = Object.fromEntries(
    Object.entries(styleBound).filter(([field]) => !(field in own))
  )
  return Object.keys(inherited).length > 0 ? inherited : NO_BINDINGS
}

function bindingsInheritedFrom(
  styleId: string | null | undefined,
  own: VariableBindings,
  styles: TextStyleLookup
): VariableBindings {
  if (!styleId) {
    return NO_BINDINGS
  }
  return notOverridden(styles(styleId), own)
}

export function inheritedTextStyleBindings(
  node: SceneNode,
  styles: TextStyleLookup
): VariableBindings {
  if (node.type !== 'TEXT') {
    return NO_BINDINGS
  }
  return bindingsInheritedFrom(node.textStyleId, node.boundVariables, styles)
}

export function inheritedRunStyleBindings(
  run: StyleRun,
  styles: TextStyleLookup
): VariableBindings {
  const own = run.style.boundVariables ?? NO_BINDINGS
  return bindingsInheritedFrom(run.style.textStyleId, own, styles)
}

function withInherited(own: VariableBindings, inherited: VariableBindings): VariableBindings {
  if (inherited === NO_BINDINGS) {
    return own
  }
  return isEmptyObject(own) ? inherited : { ...inherited, ...own }
}

export function effectiveBoundVariables(
  node: SceneNode,
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
