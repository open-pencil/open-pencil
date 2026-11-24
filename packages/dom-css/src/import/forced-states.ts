// eslint-disable-next-line @open-pencil/structure/no-mixed-case-acronym-identifiers -- Upstream export spelling.
import { parse, walk, type CssNode as CSSNode } from 'css-tree'

/**
 * The attribute that shows an element in states a static page cannot be in, such as
 * `data-force-state="hover focus-visible"`.
 */
export const FORCED_STATE_ATTRIBUTE = 'data-force-state'

const forced = (state: string) => `[${FORCED_STATE_ATTRIBUTE}~="${state}"]`

/**
 * What else matches each pseudo-class: an element forced into the state, and the states CSS implies
 * from it, as an element shown as focused by keyboard is focused. A pseudo-class that holds for an
 * element when it holds for one inside it also matches its containers.
 */
const FORCED_STATES: Partial<Record<string, { matches: string; contains: boolean }>> = {
  hover: { matches: forced('hover'), contains: true },
  active: { matches: forced('active'), contains: true },
  focus: { matches: `${forced('focus')},${forced('focus-visible')}`, contains: false },
  'focus-visible': { matches: forced('focus-visible'), contains: false },
  'focus-within': { matches: `${forced('focus')},${forced('focus-visible')}`, contains: true }
}

interface Replacement {
  start: number
  end: number
  text: string
}

/**
 * A stylesheet whose state pseudo-classes also match elements forced into the state by
 * `data-force-state`, with the specificity they had. Everything else is left as written.
 */
export function forceStates(cssText: string): string {
  const replacements: Replacement[] = []
  // `:has()` may not hold another `:has()`.
  let relational = 0
  walk(parse(cssText, { positions: true, parseValue: false, parseCustomProperty: false }), {
    enter(node: CSSNode) {
      if (node.type !== 'PseudoClassSelector') return
      const name = node.name.toLowerCase()
      if (name === 'has') relational++
      const state = Object.hasOwn(FORCED_STATES, name) ? FORCED_STATES[name] : undefined
      if (!state || node.children || !node.loc) return
      const containers = state.contains && relational === 0 ? `,:has(${state.matches})` : ''
      replacements.push({
        start: node.loc.start.offset,
        end: node.loc.end.offset,
        text: `:is(:${name},${state.matches}${containers})`
      })
    },
    leave(node: CSSNode) {
      if (node.type === 'PseudoClassSelector' && node.name.toLowerCase() === 'has') relational--
    }
  })
  let forcedText = ''
  let end = 0
  for (const replacement of replacements.sort((a, b) => a.start - b.start)) {
    forcedText += cssText.slice(end, replacement.start) + replacement.text
    end = replacement.end
  }
  return forcedText + cssText.slice(end)
}
