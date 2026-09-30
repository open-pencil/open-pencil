import { syntaxTree } from '@codemirror/language'
import { linter, type Diagnostic } from '@codemirror/lint'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'

import type { LayerIssue } from '@/app/code/layer-issues'

import { linkedElements, setLayerLinks, type LinkedElement } from './layer-links'

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
  const matches: Array<TextRange & { rank: number }> = []
  syntaxTree(state).iterate({
    from: element.from,
    to: element.openTo,
    enter(node) {
      // Ancestors contain the element; only nested elements' attributes belong to others.
      if (node.name === 'JSXElement' && node.from > element.from) return false
      if (node.name !== 'JSXAttribute') return undefined
      const name = node.node.firstChild
      const rank = name ? props.indexOf(state.doc.sliceString(name.from, name.to)) : -1
      if (rank !== -1) matches.push({ from: node.from, to: node.to, rank })
      return false
    }
  })
  const best = matches.toSorted((a, b) => a.rank - b.rank).at(0)
  return best ? { from: best.from, to: best.to } : null
}

function diagnosticsFor(state: EditorState): Diagnostic[] {
  const issues = state.field(layerIssues)
  if (issues.length === 0) return []
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
  return diagnostics
}

/** Underlines code whose layers have design issues, on the attribute that causes them. */
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
        )
    })
  ]
}
