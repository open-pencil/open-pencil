// eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { parse, walk, type CssNode as CSSNode } from 'css-tree'
import { compact, uniq } from 'es-toolkit'

import type { DesignDocument, DesignElement } from '../types'

/**
 * The attribute that shows an element in states a static page cannot be in, such as
 * `data-force-state="hover focus-visible"`.
 */
export const FORCED_STATE_ATTRIBUTE = 'data-force-state'

/** The states CSS implies from each on the element itself: keyboard focus is focus. */
const IMPLIED = new Map([
  ['focus', ['focus-within']],
  ['focus-visible', ['focus', 'focus-within']]
])

/** The states that hold for what contains an element in them. */
const CONTAINED = new Set(['hover', 'active', 'focus-within'])

const STATES = new Set(['hover', 'active', 'focus', 'focus-visible', 'focus-within'])

function statesOf(attrs: Readonly<Record<string, string>>): string[] {
  const named = compact((attrs[FORCED_STATE_ATTRIBUTE] ?? '').split(/\s+/))
  return named.flatMap((state) => [state, ...(IMPLIED.get(state) ?? [])])
}

/** Marks an element and what holds it with the states they are in; returns those it passes up. */
function markElement(element: DesignElement): Set<string> {
  const states = new Set(statesOf(element.attrs))
  for (const child of element.children) {
    if (child.type !== 'element') continue
    for (const state of markElement(child)) states.add(state)
  }
  if (states.size > 0) element.attrs[FORCED_STATE_ATTRIBUTE] = [...states].join(' ')
  return new Set([...states].filter((state) => CONTAINED.has(state)))
}

/**
 * The document with each forced state written on every element it holds for, as `:hover` holds for
 * what contains a hovered element, or null when it forces none.
 */
export function withForcedStates(document: DesignDocument): DesignDocument | null {
  const marked = structuredClone(document)
  let forces = false
  for (const child of marked.children) {
    if (child.type !== 'element') continue
    markElement(child)
    forces ||= holdsForcedState(child)
  }
  return forces ? marked : null
}

function holdsForcedState(element: DesignElement): boolean {
  if (Object.hasOwn(element.attrs, FORCED_STATE_ATTRIBUTE)) return true
  return element.children.some((child) => child.type === 'element' && holdsForcedState(child))
}

/** The root's attributes with the states its own imply, or null when they force none. */
export function rootForcedStates(
  attributes: Readonly<Record<string, string>> = {}
): Record<string, string> | null {
  const states = statesOf(attributes)
  if (states.length === 0) return null
  return { ...attributes, [FORCED_STATE_ATTRIBUTE]: uniq(states).join(' ') }
}

/**
 * A stylesheet whose state pseudo-classes also match elements forced into the state by
 * `data-force-state`, with the specificity they had. Everything else is left as written.
 */
export function forceStates(cssText: string): string {
  const pseudoClasses: { name: string; start: number; end: number }[] = []
  const sheet = parse(cssText, {
    positions: true,
    parseValue: false,
    parseCustomProperty: false,
    onParseError: () => undefined
  })
  walk(sheet, (node: CSSNode) => {
    if (node.type !== 'PseudoClassSelector' || node.children || !node.loc) return
    const name = node.name.toLowerCase()
    if (!STATES.has(name)) return
    pseudoClasses.push({ name, start: node.loc.start.offset, end: node.loc.end.offset })
  })
  let text = ''
  let end = 0
  for (const { name, start, end: after } of pseudoClasses.sort((a, b) => a.start - b.start)) {
    text += `${cssText.slice(end, start)}:is(:${name},[${FORCED_STATE_ATTRIBUTE}~="${name}"])`
    end = after
  }
  return text + cssText.slice(end)
}
