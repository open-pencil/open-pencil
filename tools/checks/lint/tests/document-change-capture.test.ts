import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-document-change-capture'
const rules = { [`open-pencil/${rule}`]: 'error' }
const capture = "import { captureDocumentChange } from '#core/editor/history/document-change'"

describe('no-document-change-capture', () => {
  test.each([
    'packages/core/src/editor/alignment/arrange.ts',
    'packages/core/src/tools/structure/arrange.ts',
    'src/app/ai/tools/runner.ts'
  ])('rejects a capture in %s', async (path) => {
    expect(ruleDiagnostics(await lint(capture, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    'packages/core/src/editor/history/edit.ts',
    'packages/core/tests/editor/history/document-change.test.ts'
  ])('accepts a capture in %s', async (path) => {
    expect(ruleDiagnostics(await lint(capture, rules, path), rule)).toHaveLength(0)
  })

  test('accepts the other document change helpers anywhere', async () => {
    const source =
      "import { isEmptyDocumentChange, restoreDocumentChange } from '#core/editor/history/document-change'"
    const path = 'packages/core/src/editor/undo.ts'
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })
})
