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

const BUILTIN_ELEMENTS = new Set(ELEMENTS)
const PROPERTY_SET = new Set(PROPS)
const HELPER_SET = new Set(HELPERS)

function completionType(label: string): 'class' | 'function' | 'property' {
  if (BUILTIN_ELEMENTS.has(label)) return 'class'
  if (HELPER_SET.has(label)) return 'function'
  return 'property'
}

function completeDesignJSX(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/[\w]*$/)
  if (!before || (before.from === before.to && !context.explicit)) return null
  const documentLine = context.state.doc.lineAt(context.pos)
  const line = documentLine.text.slice(0, context.pos - documentLine.from)
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

function localComponentNames(view: EditorView): Set<string> {
  const names = new Set<string>()
  const source = view.state.doc.toString()
  for (const match of source.matchAll(/\b(?:const|let|var|function)\s+([A-Z][\w$]*)/g)) {
    const name = match[1]
    if (name) names.add(name)
  }
  return names
}

function semanticDiagnostics(view: EditorView): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const knownElements = new Set([...BUILTIN_ELEMENTS, ...localComponentNames(view)])
  const tree = syntaxTree(view.state)
  tree.iterate({
    enter(node) {
      if (node.name !== 'JSXIdentifier') return
      const parentName = node.node.parent?.name
      const name = view.state.doc.sliceString(node.from, node.to)
      if (parentName === 'JSXAttribute' && !PROPERTY_SET.has(name)) {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: 'warning',
          message: `Unknown OpenPencil property “${name}”.`
        })
        return
      }
      if (
        (parentName === 'JSXOpenTag' ||
          parentName === 'JSXSelfClosingTag' ||
          parentName === 'JSXCloseTag') &&
        /^[A-Z]/.test(name) &&
        !knownElements.has(name)
      ) {
        diagnostics.push({
          from: node.from,
          to: node.to,
          severity: 'warning',
          message: `Unknown OpenPencil element <${name}>.`
        })
      }
    }
  })
  return diagnostics
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
  return [
    autocompletion({ override: [completeDesignJSX] }),
    linter((view) => [...syntaxDiagnostics(view), ...semanticDiagnostics(view)])
  ]
}
