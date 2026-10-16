import { expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import {
  formatVariableFormula,
  parseVariableFormula,
  variableFormulaReference
} from '@open-pencil/scene-graph'

import {
  applyTokenValueEdit,
  parseTokenEditorText,
  tokenEditorText
} from '@/app/editor/tokens/value-editor'

test('one value source switches between literals, references, formulas and CSS with undo', () => {
  const editor = createEditor()
  const graph = editor.graph
  const collection = graph.createCollection('Spacing')
  const mode = collection.defaultModeId
  const base = graph.createVariable('base', 'FLOAT', collection.id, 4)
  const target = graph.createVariable('target', 'FLOAT', collection.id, 8)
  const formula = {
    parse: (modeId: string, text: string) => parseVariableFormula(graph, target.id, modeId, text),
    format: (value: Parameters<typeof formatVariableFormula>[1]) =>
      formatVariableFormula(graph, value),
    reference: (id: string) => variableFormulaReference(graph, id)
  }
  const parse = (text: string) =>
    parseTokenEditorText(target, mode, text, formula, (css) => css === 'clamp(1rem, 4vw, 2rem)')
  const apply = (text: string) => applyTokenValueEdit(editor, target.id, mode, parse(text))
  try {
    apply('{base} * 3')
    expect(graph.resolveVariable(target.id, mode)).toBe(12)
    expect(tokenEditorText(target, mode, formula)).toContain('* 3')
    apply('clamp(1rem, 4vw, 2rem)')
    expect(target.valuesByMode[mode]).toBe(12)
    expect(target.expressions?.[mode]).toEqual({ css: 'clamp(1rem, 4vw, 2rem)', resolved: 12 })
    expect(tokenEditorText(target, mode, formula)).toBe('clamp(1rem, 4vw, 2rem)')
    apply('{base}')
    expect(target.valuesByMode[mode]).toEqual({ aliasId: base.id })
    expect(target.expressions).toBeUndefined()
    editor.undo.undo()
    expect(tokenEditorText(target, mode, formula)).toBe('clamp(1rem, 4vw, 2rem)')
    expect(target.valuesByMode[mode]).toBe(12)
    editor.undo.redo()
    expect(target.valuesByMode[mode]).toEqual({ aliasId: base.id })
    apply('20')
    expect(target.valuesByMode[mode]).toBe(20)
    expect(() => apply('{target} * 2')).toThrow('Circular')
    expect(() => apply('1 / 0')).toThrow()
    expect(() => apply('12nonsense')).toThrow()
    expect(target.valuesByMode[mode]).toBe(20)
    target.unit = 'rem'
    apply('2')
    expect(target.valuesByMode[mode]).toBe(32)
    expect(tokenEditorText(target, mode, formula)).toBe('2')
  } finally {
    editor.dispose()
  }
})

test('Boolean references and operators share the same editor and reject CSS', () => {
  const editor = createEditor()
  const graph = editor.graph
  const collection = graph.createCollection('Flags')
  const mode = collection.defaultModeId
  graph.createVariable('enabled', 'BOOLEAN', collection.id, true)
  const target = graph.createVariable('visible', 'BOOLEAN', collection.id, true)
  const formula = {
    parse: (modeId: string, text: string) => parseVariableFormula(graph, target.id, modeId, text),
    format: (value: Parameters<typeof formatVariableFormula>[1]) =>
      formatVariableFormula(graph, value),
    reference: (id: string) => variableFormulaReference(graph, id)
  }
  try {
    const edit = parseTokenEditorText(target, mode, 'NOT {enabled}', formula, () => false)
    expect(edit.resolved).toBe(false)
    applyTokenValueEdit(editor, target.id, mode, edit)
    expect(graph.resolveVariable(target.id, mode)).toBe(false)
    expect(() =>
      parseTokenEditorText(target, mode, 'var(--enabled)', formula, () => true)
    ).toThrow()
    expect(parseTokenEditorText(target, mode, 'true', formula, () => false)).toMatchObject({
      value: true,
      kind: 'literal'
    })
  } finally {
    editor.dispose()
  }
})
