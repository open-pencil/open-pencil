import type { EditorCommandId } from '@open-pencil/vue/editor/commands'

import type { runFocusedCommand } from '@/app/shell/commands/focused'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

type FocusedCommands = { runFocusedCommand: typeof runFocusedCommand }

/** Runs a command as the native menu does, and returns the commands that reached the editor. */
function runAsNativeMenu(id: EditorCommandId): Promise<string[]> {
  return editor.page.evaluate(async (id) => {
    const modulePath = '/src/app/shell/commands/focused.ts'
    const commands: FocusedCommands = await import(modulePath)
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const ran: string[] = []
    commands.runFocusedCommand(store, (command) => ran.push(command), id)
    return ran
  }, id)
}

async function focusTextField(value: string) {
  await editor.page.evaluate((value) => {
    const field = document.createElement('input')
    field.dataset.testId = 'focused-command-field'
    field.value = value
    document.body.append(field)
  }, value)
  const field = editor.page.getByTestId('focused-command-field')
  await field.focus()
  return field
}

test.afterEach(async () => {
  await editor.page.evaluate(() =>
    document.querySelector('[data-test-id="focused-command-field"]')?.remove()
  )
})

test('Select All and Undo from the menu edit a focused text field', async () => {
  const field = await focusTextField('')
  await field.pressSequentially('hello world')

  expect(await runAsNativeMenu('selection.selectAll')).toEqual([])
  expect(
    await field.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])
  ).toEqual([0, 11])

  expect(await runAsNativeMenu('edit.undo')).toEqual([])
  await expect(field).toHaveValue('')
  expect(await runAsNativeMenu('edit.redo')).toEqual([])
  await expect(field).toHaveValue('hello world')
})

test('Undo and Redo from the menu reach an editor that keeps its own history', async () => {
  // As CodeMirror's history() does: it answers the browser's history input events itself.
  await editor.page.evaluate(() => {
    const field = document.createElement('div')
    field.dataset.testId = 'focused-command-field'
    field.contentEditable = 'true'
    field.dataset.history = ''
    field.addEventListener('beforeinput', (event) => {
      if (!event.inputType.startsWith('history')) return
      event.preventDefault()
      field.dataset.history += `${event.inputType} `
    })
    document.body.append(field)
    field.focus()
  })
  const field = editor.page.getByTestId('focused-command-field')

  expect(await runAsNativeMenu('edit.undo')).toEqual([])
  expect(await runAsNativeMenu('edit.redo')).toEqual([])
  await expect(field).toHaveAttribute('data-history', 'historyUndo historyRedo ')
})

test('canvas commands wait while a text field has focus, view commands do not', async () => {
  await focusTextField('Name')

  expect(await runAsNativeMenu('selection.duplicate')).toEqual([])
  expect(await runAsNativeMenu('selection.group')).toEqual([])
  expect(await runAsNativeMenu('view.zoomFit')).toEqual(['view.zoomFit'])
})

test('menu commands act on the document when the canvas has focus', async () => {
  await editor.page.locator('canvas').first().focus()

  expect(await runAsNativeMenu('selection.selectAll')).toEqual(['selection.selectAll'])
  expect(await runAsNativeMenu('edit.undo')).toEqual(['edit.undo'])
})

test('a page field keeps its edits while a canvas text edit stays open', async () => {
  await editor.canvas.selectTool('text')
  await editor.canvas.click(300, 300)
  await editor.page.keyboard.type('Hi')
  // In the canvas text editor, Select All selects its text and leaves the document alone.
  expect(await runAsNativeMenu('selection.selectAll')).toEqual([])

  // Focus leaves for a page field; the text edit stays open behind it.
  const field = await focusTextField('')
  await field.pressSequentially('abc')

  expect(await runAsNativeMenu('selection.duplicate')).toEqual([])
  expect(await runAsNativeMenu('edit.undo')).toEqual([])
  await expect(field).toHaveValue('')
})
