import { syntaxTree } from '@codemirror/language'
import { linter, type Diagnostic } from '@codemirror/lint'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'

import { designJSXPropertyNames } from '@open-pencil/design-jsx'

import type { LayerIssue } from '@/app/code/layers/issues'

import { layerLinkConfig, linkedElements, setLayerLinks, type LinkedElement } from './links'
import { staleAttributes } from './stale'

export const setLayerIssues = StateEffect.define<readonly LayerIssue[]>()

const layerIssues = StateField.define<readonly LayerIssue[]>({
  create: () => [],
  update(value, transaction) {
    for (const effect of transaction.effects) if (effect.is(setLayerIssues)) return effect.value
    return value
  }
})

interface TextRange {
  from: number
  to: number
}

/** The first of `props` set on the element's opening tag, as written in the code. */
function attributeRange(
  state: EditorState,
  element: LinkedElement,
  props: readonly string[]
): TextRange | null {
  if (props.length === 0) return null
  // A property written under an alias, such as `width` for `w`, is the same property.
  const names = props.flatMap((name) => designJSXPropertyNames(name))
  const matches: Array<TextRange & { rank: number }> = []
  syntaxTree(state).iterate({
    from: element.from,
    to: element.openTo,
    enter(node) {
      // Ancestors contain the element; only nested elements' attributes belong to others.
      if (node.name === 'JSXElement' && node.from > element.from) return false
      if (node.name !== 'JSXAttribute') return undefined
      const name = node.node.firstChild
      const rank = name ? names.indexOf(state.doc.sliceString(name.from, name.to)) : -1
      if (rank !== -1) matches.push({ from: node.from, to: node.to, rank })
      return false
    }
  })
  const best = matches.toSorted((a, b) => a.rank - b.rank).at(0)
  return best ? { from: best.from, to: best.to } : null
}

function diagnosticsFor(state: EditorState): Diagnostic[] {
  const issues = state.field(layerIssues)
  const byNode = new Map<string, LayerIssue[]>()
  for (const issue of issues) byNode.set(issue.nodeId, [...(byNode.get(issue.nodeId) ?? []), issue])
  const diagnostics: Diagnostic[] = []
  const seen = new Set<string>()
  for (const element of state.field(linkedElements)) {
    for (const nodeId of element.nodeIds) {
      for (const issue of byNode.get(nodeId) ?? []) {
        const range = attributeRange(state, element, issue.props) ?? {
          from: element.nameFrom,
          to: element.nameTo
        }
        // Layers repeated from one element, such as a component used twice, report once.
        const key = `${range.from}:${range.to}:${issue.message}`
        if (seen.has(key)) continue
        seen.add(key)
        diagnostics.push({ ...range, severity: issue.severity, message: issue.message })
      }
    }
  }
  for (const range of state.field(staleAttributes, false) ?? []) {
    const message = state.facet(layerLinkConfig)?.staleMessage?.(range)
    if (message) diagnostics.push({ from: range.from, to: range.to, severity: 'info', message })
  }
  return diagnostics
}

/**
 * Underlines code whose layers have design issues, on the attribute that causes them, and
 * expression attributes whose layers changed on the canvas since.
 */
export function layerIssueDiagnostics(): Extension {
  return [
    layerIssues,
    linter((view) => diagnosticsFor(view.state), {
      delay: 0,
      needsRefresh: (update) =>
        update.transactions.some((transaction) =>
          transaction.effects.some(
            (effect) => effect.is(setLayerIssues) || effect.is(setLayerLinks)
          )
        ) ||
        update.startState.field(staleAttributes, false) !==
          update.state.field(staleAttributes, false)
    })
  ]
}
