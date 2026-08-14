import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { autocompletion } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import { linter, type Diagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import {
  DESIGN_JSX_ELEMENTS,
  DESIGN_JSX_HELPERS,
  DESIGN_JSX_PROPERTIES
} from '@open-pencil/core/design-jsx'

const ELEMENTS = DESIGN_JSX_ELEMENTS.map(({ name }) => name)
const PROPS = DESIGN_JSX_PROPERTIES.map(({ name }) => name)
const HELPERS = DESIGN_JSX_HELPERS.map(({ name }) => name)

const ELEMENT_SET = new Set(ELEMENTS)
const HELPER_SET = new Set(HELPERS)

function completionType(label: string): 'class' | 'function' | 'property' {
  if (ELEMENT_SET.has(label)) return 'class'
  if (HELPER_SET.has(label)) return 'function'
  return 'property'
}

function completeDesignJSX(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/[\w]*$/)
  if (!before || (before.from === before.to && !context.explicit)) return null
  const line = context.state.doc.lineAt(context.pos).text.slice(0, context.pos - before.from)
  const isInsideTag = line.lastIndexOf('<') > line.lastIndexOf('>')
  const labels = isInsideTag ? [...ELEMENTS, ...PROPS] : HELPERS
  return {
    from: before.from,
    options: labels.map((label) => ({
      label,
      type: completionType(label)
    }))
  }
}

function syntaxDiagnostics(view: EditorView): Diagnostic[] {
  const errors: Diagnostic[] = []
  const tree = syntaxTree(view.state)
  tree.iterate({
    enter(node) {
      if (node.type.isError) {
        errors.push({
          from: node.from,
          to: Math.max(node.from + 1, node.to),
          severity: 'error',
          message: 'Invalid JSX syntax.'
        })
      }
    }
  })
  return errors
}

export function designJSXExtensions(): Extension[] {
  return [autocompletion({ override: [completeDesignJSX] }), linter(syntaxDiagnostics)]
}
