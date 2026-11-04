import {
  insertCompletionText,
  type Completion,
  type CompletionContext
} from '@codemirror/autocomplete'
import { StreamLanguage } from '@codemirror/language'
import type { EditorState } from '@codemirror/state'
import { tags } from '@lezer/highlight'

import {
  formulaTokens,
  readFormulaToken,
  type FormulaTokenKind
} from '@open-pencil/scene-graph/variables'

import { nodeText, tokenBefore, type SyntaxNode } from './syntax'
import type { ExpressionDialect, ReferenceCompletion } from './types'

/**
 * The formula syntax as a CodeMirror language, read by Scene Graph's tokenizer, so completion
 * and pills see the tokens the parser does. Each token is its own syntax node named by kind.
 */
const formulaLanguage = StreamLanguage.define<null>({
  name: 'formula',
  startState: () => null,
  token(stream) {
    if (stream.eatSpace()) return null
    const token = readFormulaToken(stream.string, stream.pos)
    stream.pos = token.to
    return token.kind
  },
  tokenTable: {
    reference: tags.special(tags.variableName),
    name: tags.variableName,
    string: tags.string,
    color: tags.color,
    function: tags.function(tags.variableName),
    comma: tags.separator
  } satisfies Partial<Record<FormulaTokenKind, unknown>>,
  // Adjacent operators or parentheses stay separate nodes, as the parser reads them.
  mergeTokens: false
})

/**
 * A variable path being typed, such as `space/ba`, reads as names joined by `/` operators; its
 * start is the first name of the run of touching tokens that ends at the caret. A function's
 * name, such as `text`, is still a word being typed until a `(` follows it.
 */
function pathStart(state: EditorState, last: SyntaxNode): number | undefined {
  const isSlash = (node: SyntaxNode) => node.name === 'operator' && nodeText(state, node) === '/'
  if (last.name === 'function') return last.from
  if (last.name !== 'name' && !isSlash(last)) return undefined
  let first = last
  for (let node = last.prevSibling; node && node.to === first.from; node = node.prevSibling) {
    if (node.name !== 'name' && !isSlash(node)) break
    first = node
  }
  return first.name === 'name' ? first.from : undefined
}

/** Where the completion replaces from, and whether it sits inside braces, or none if it should not open. */
function completionRange(context: CompletionContext) {
  const { state, pos } = context
  const token = tokenBefore(state, pos)
  // An open reference runs to the line's end while it is typed, so check the text before the caret.
  if (token?.name === 'reference' && !state.sliceDoc(token.from, pos).includes('}'))
    return { from: token.from + 1, braced: true }
  const path = token?.to === pos ? pathStart(state, token) : undefined
  if (path !== undefined) return { from: path, braced: false }
  // A logic word must be finished, with a space after it, before it can take an operand.
  const operand =
    !token ||
    token.name === 'operator' ||
    token.name === 'comma' ||
    (token.name === 'keyword' && token.to < pos) ||
    (token.name === 'paren' && nodeText(state, token) === '(')
  return operand || context.explicit ? { from: pos, braced: false } : undefined
}

/**
 * Variables and functions complete wherever an operand goes: while a name or `{` reference is
 * typed, and after an operator, `(`, `,` or a logic word; inside braces only variables do. The syntax tree says which, so completion agrees
 * with the parser about what each piece of text is.
 */
function completeFormula(references: () => readonly ReferenceCompletion[]) {
  return (context: CompletionContext) => {
    const range = completionRange(context)
    if (!range) return null
    const { from, braced } = range
    return {
      from,
      validFor: braced ? /^[^{}]*$/ : /^[\p{L}\p{N}_$/]*$/u,
      options: references().flatMap(({ label, section, detail, insert, kind = 'variable' }) =>
        braced && kind === 'function'
          ? []
          : ({
              label,
              section,
              detail,
              type: kind,
              apply(view, _completion, _from, to) {
                const start = braced ? from - 1 : from
                const next = view.state.sliceDoc(to, to + 1)
                const end = braced && next === '}' ? to + 1 : to
                // A call whose `(` is already there takes its name alone.
                const text = kind === 'function' && next === '(' ? label : insert
                view.dispatch(insertCompletionText(view.state, text, start, end))
              }
            } satisfies Completion)
      )
    }
  }
}

export const formulaDialect: ExpressionDialect = {
  language: formulaLanguage,
  complete: completeFormula,
  references: (source) =>
    formulaTokens(source).flatMap(({ kind, text, from, to }) =>
      kind === 'reference' && text.endsWith('}') ? [{ source: text, from, to }] : []
    )
}
