import { describe, expect, test } from 'bun:test'

import dedent from 'dedent'

import { lint, ruleDiagnostics } from './helpers/lint.ts'

const rule = 'no-editor-profile-inputs'
const rules = { [`open-pencil/${rule}`]: 'error' }
const check = "export const previewing = editor.state.canvasView.id === 'play'"
const path = 'packages/vue/src/canvas/useCanvasInput.ts'

describe('no-editor-profile-inputs', () => {
  test.each([
    'packages/vue/src/canvas/useCanvasInput.ts',
    'packages/core/src/canvas/renderer/pipeline.ts',
    'src/app/shell/keyboard/registry.ts',
    'packages/docs/.vitepress/theme/landing/stage/controls.ts'
  ])('rejects a view check in %s', async (path) => {
    expect(ruleDiagnostics(await lint(check, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    'packages/core/src/editor/views/actions.ts',
    'packages/core/src/editor/state/view.ts',
    'packages/core/tests/editor/play/states.test.ts'
  ])('accepts a view check in %s', async (path) => {
    expect(ruleDiagnostics(await lint(check, rules, path), rule)).toHaveLength(0)
  })

  test.each([
    "export const previewing = editor.state['canvasView'].id === 'play'",
    'export const previewing = editor.state[`canvasView`].id',
    'export const view = editor.state.canvasView',
    'export const { id } = editor.state.canvasView',
    'export const { canvasView } = editor.state',
    "export const { ['hostRestrictions']: limits } = editor.state"
  ])('rejects reading the view: %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(1)
  })

  test('accepts a key read from a variable', async () => {
    const source = 'export const read = (key: string) => editor.state[key]'
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })

  test('rejects reading the view in a Vue template', async () => {
    const source = dedent`
      <script setup lang="ts">
      defineProps<{ state: { canvasView: { id: string } } }>()
      </script>
      <template><div v-if="state.canvasView.id === 'play'" /></template>
    `
    const component = 'src/components/Fixture.vue'
    expect(ruleDiagnostics(await lint(source, rules, component), rule)).toHaveLength(1)
  })

  test('accepts the view in a type', async () => {
    const source = "export type View = Pick<EditorState, 'canvasView'> & { canvasView: CanvasView }"
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })

  const restriction = 'export const locked = editor.state.hostRestrictions.readOnly'

  test.each([
    'packages/vue/src/canvas/useCanvasInput.ts',
    'packages/core/src/canvas/renderer/pipeline.ts',
    'src/components/CodePanel.ts',
    'packages/cli/src/app/session.ts'
  ])('rejects reading the restrictions in %s', async (path) => {
    expect(ruleDiagnostics(await lint(restriction, rules, path), rule)).toHaveLength(1)
  })

  test.each([
    'packages/core/src/editor/read-only/index.ts',
    'packages/core/src/editor/views/profile.ts',
    'src/app/collab/yjs-sync.ts'
  ])('accepts reading the restrictions in %s, which owns or sets them', async (path) => {
    expect(ruleDiagnostics(await lint(restriction, rules, path), rule)).toHaveLength(0)
  })

  test('the host still reads the view through the profile', async () => {
    const path = 'src/app/collab/yjs-sync.ts'
    expect(ruleDiagnostics(await lint(check, rules, path), rule)).toHaveLength(1)
  })

  test('accepts an unrelated restrictions field', async () => {
    const source = 'export const limits = account.restrictions'
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })

  const kind = "export const board = editor.state.documentKind === 'board'"

  test.each(['packages/vue/src/canvas/useCanvasInput.ts', 'src/components/toolbar/Toolbar.ts'])(
    'rejects reading the document kind in the front end %s',
    async (path) => {
      expect(ruleDiagnostics(await lint(kind, rules, path), rule)).toHaveLength(1)
    }
  )

  test.each([
    'packages/fig/src/archive.ts',
    'packages/core/src/editor/document-settings.ts',
    'src/app/editor/session/create.ts'
  ])('accepts reading the document kind in %s, which keeps or saves it', async (path) => {
    expect(ruleDiagnostics(await lint(kind, rules, path), rule)).toHaveLength(0)
  })

  test('accepts reading the profile anywhere', async () => {
    const source = "export const panOnly = resolveEditorProfile(state).pointer === 'pan'"
    expect(ruleDiagnostics(await lint(source, rules, path), rule)).toHaveLength(0)
  })
})
