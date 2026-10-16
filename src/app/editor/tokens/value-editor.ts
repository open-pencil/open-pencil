import { isEqual, omit } from 'es-toolkit'

import type { Editor } from '@open-pencil/core/editor'
import type { TokenExpression, Variable, VariableValue } from '@open-pencil/scene-graph'

import { parseTokenValueText, tokenValueText, type TokenFormulaActions } from './model'

export interface TokenValueEdit {
  value: VariableValue
  expression?: TokenExpression
  resolved: number | boolean
  kind: 'literal' | 'reference' | 'formula' | 'css'
}

export function tokenEditorText(variable: Variable, modeId: string, formula: TokenFormulaActions) {
  const value = variable.valuesByMode[modeId]
  return (
    variable.expressions?.[modeId]?.css ??
    (typeof value === 'object' ? formula.format(value) : tokenValueText(variable, value))
  )
}

/** One source field; CSS remains export metadata with a stable canvas fallback. */
export function parseTokenEditorText(
  variable: Variable,
  modeId: string,
  source: string,
  formula: TokenFormulaActions,
  acceptsCSS: (source: string) => boolean
): TokenValueEdit {
  const text = source.trim()
  const literal = parseTokenValueText(variable, text)
  if (typeof literal === 'number') return { value: literal, resolved: literal, kind: 'literal' }
  try {
    const result = formula.parse(modeId, text)
    let kind: TokenValueEdit['kind'] = 'literal'
    if (typeof result.value === 'object') kind = 'aliasId' in result.value ? 'reference' : 'formula'
    return { ...result, kind }
  } catch (error) {
    if (variable.type !== 'FLOAT' || !acceptsCSS(text)) throw error
    const current = variable.valuesByMode[modeId]
    const resolved = formula.parse(modeId, formula.format(current)).resolved
    if (typeof resolved !== 'number') throw error
    return { value: resolved, resolved, expression: { css: text, resolved }, kind: 'css' }
  }
}

/** Switching the input's form replaces both sources together, including on undo. */
export function applyTokenValueEdit(
  editor: Editor,
  id: string,
  modeId: string,
  edit: TokenValueEdit
) {
  const variable = editor.graph.variables.get(id)
  if (!variable) return
  if (
    isEqual(variable.valuesByMode[modeId], edit.value) &&
    isEqual(variable.expressions?.[modeId], edit.expression)
  )
    return
  const expressions: Record<string, TokenExpression> = omit(variable.expressions ?? {}, [modeId])
  if (edit.expression) expressions[modeId] = edit.expression
  editor.undo.runBatch('Update variable value', () => {
    editor.updateVariableValue(id, modeId, edit.value)
    editor.updateVariableToken(id, {
      expressions: Object.keys(expressions).length ? expressions : undefined
    })
  })
}
