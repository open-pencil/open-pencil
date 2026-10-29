import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-canvas-view-checks'
const rules = { [`open-pencil/${rule}`]: 'error' }
const check = "export const previewing = editor.state.canvasView.id === 'play'"
const path = 'packages/vue/src/canvas/useCanvasInput.ts'

describe('no-canvas-view-checks', () => {
  test.each([
    'packages/vue/src/canvas/useCanvasInput.ts',
    'packages/core/src/canvas/renderer/pipeline.ts',
    'src/app/shell/keyboard/registry.ts'
  ])('rejects a view check in %s', async (path) => {
    expect(ruleDiagnostics(await lint(check, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    'packages/core/src/editor/views/actions.ts',
    'packages/core/tests/editor/play/states.test.ts'
  ])('accepts a view check in %s', async (path) => {
    expect(ruleDiagnostics(await lint(check, rules, path), rule)).toHaveLength(0)
  })

  test.each([
    "export const previewing = editor.state['canvasView']['id'] === 'play'",
    "export const previewing = editor.state.canvasView['id'] === 'play'"
  ])('rejects a fixed bracket key: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(1)
  })

  test('accepts a key read from a variable', async () => {
    const source = 'export const read = (id: string) => editor.state.canvasView[id]'
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })

  test('accepts reading the profile anywhere', async () => {
    const source = "export const panOnly = resolveEditorProfile(state).pointer === 'pan'"
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })
})
