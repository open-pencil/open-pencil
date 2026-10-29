import {
  insertCompletionText,
  type Completion,
  type CompletionContext
} from '@codemirror/autocomplete'
import { StreamLanguage } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'

import {
  cssTokenProperty,
  cssValueTokens,
  type CSSValueTokenKind
} from '@open-pencil/dom-css/export'

import { nodeText, tokenBefore, type SyntaxNode } from './syntax'
import type { ExpressionDialect, ReferenceCompletion } from './types'

/** The CSS math functions a token value is usually written with. */
const FUNCTIONS = [
  { label: 'calc', detail: 'expression' },
  { label: 'clamp', detail: 'min, preferred, max' },
  { label: 'min', detail: 'a, b, …' },
  { label: 'max', detail: 'a, b, …' }
]

/** A CSS value as a CodeMirror language, read by Scene Graph's CSS value tokenizer. */
const cssValueLanguage = StreamLanguage.define<null>({
  name: 'css-value',
  startState: () => null,
  token(stream) {
    // A token value is one short line, so reading it again for each token costs little.
    const token = cssValueTokens(stream.string).find(({ to }) => to > stream.pos)
    if (!token || token.from > stream.pos) {
      stream.pos = token?.from ?? stream.string.length
      return null
    }
    stream.pos = token.to
    return token.kind
  },
  tokenTable: {
    reference: tags.special(tags.variableName),
    property: tags.variableName,
    function: tags.function(tags.variableName),
    separator: tags.separator
  } satisfies Partial<Record<CSSValueTokenKind, unknown>>,
  mergeTokens: false
})

/** The start of an unfinished `var(` the caret is inside, right after its `(` or its name. */
function openVarStart(state: EditorState, token: SyntaxNode, pos: number) {
  const paren = token.name === 'property' && token.to === pos ? token.prevSibling : token
  if (paren?.name !== 'paren' || nodeText(state, paren) !== '(' || paren.to > pos) return undefined
  const name = paren.prevSibling
  return name?.name === 'function' && name.to === paren.from && nodeText(state, name) === 'var'
    ? name.from
    : undefined
}

interface CompletionRange {
  /** Where the typed text starts, which filters the list. */
  from: number
  /** Where a chosen option replaces from, which includes an unfinished `var(`. */
  replace: number
  variablesOnly: boolean
}

function completionRange(context: CompletionContext): CompletionRange | undefined {
  const { state, pos } = context
  const token = tokenBefore(state, pos)
  // A `-` at the caret may be the start of a custom property, so the list reads from it.
  const minus = token?.to === pos && token.name === 'operator' && nodeText(state, token) === '-'
  const typed = token?.to === pos && (minus || ['property', 'keyword'].includes(token.name))
  const variable = token ? openVarStart(state, token, pos) : undefined
  if (token && variable !== undefined)
    return { from: typed ? token.from : pos, replace: variable, variablesOnly: true }
  if (token && typed) return { from: token.from, replace: token.from, variablesOnly: false }
  const operand =
    !token ||
    ['separator', 'operator'].includes(token.name) ||
    (token.name === 'paren' && nodeText(state, token) === '(')
  return operand || context.explicit ? { from: pos, replace: pos, variablesOnly: false } : undefined
}

/**
 * Token names complete as `var(--name)` while a name or `var(` is typed and wherever a value
 * goes, alongside the math functions; the syntax tree says which.
 */
function completeCSSValue(references: () => readonly ReferenceCompletion[]) {
  return (context: CompletionContext) => {
    const range = completionRange(context)
    if (!range) return null
    const insert = (text: string, closes: boolean) =>
      ((view, _completion, _from, to) => {
        const end = closes && view.state.sliceDoc(to, to + 1) === ')' ? to + 1 : to
        view.dispatch(insertCompletionText(view.state, text, range.replace, end))
      }) satisfies Completion['apply']
    const variables = references().map(({ label, section, detail, insert: text }): Completion => ({
      label,
      section,
      detail,
      type: 'variable',
      apply: insert(text, range.variablesOnly)
    }))
    const functions = FUNCTIONS.map(({ label, detail }): Completion => ({
      label,
      detail,
      type: 'function',
      apply: insert(`${label}(`, false)
    }))
    return {
      from: range.from,
      validFor: /^[\w-]*$/,
      options: range.variablesOnly ? variables : [...functions, ...variables]
    }
  }
}

export const cssValueDialect: ExpressionDialect = {
  language: cssValueLanguage,
  complete: completeCSSValue,
  // The pill covers the custom property inside `var()`, which stays visible as CSS.
  references: (source) =>
    cssValueTokens(source).flatMap((token) => {
      const property = token.kind === 'reference' ? cssTokenProperty(token) : undefined
      if (!property) return []
      const from = token.from + token.text.indexOf(property)
      return [{ source: property, from, to: from + property.length }]
    })
}
