import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

/** A Motion collection with one timing and one easing, and the variables dialog open on it. */
test.beforeAll(async () => {
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const collection = store.graph.createCollection('Motion')
    store.graph.createVariable('fast', 'TIMING', collection.id, 0.15)
    store.graph.createVariable('standard', 'EASING', collection.id, { easing: 'INOUT_CUBIC' })
    store.state.sceneVersion++
  })
  await editor.page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  await expect(editor.page.getByTestId('variables-dialog')).toBeVisible()
})

function stored(name: string) {
  return editor.page.evaluate((variableName) => {
    const graph = window.openPencil?.getStore?.().graph
    const variable = [...(graph?.variables.values() ?? [])].find(
      (candidate) => candidate.name === variableName
    )
    return variable && Object.values(variable.valuesByMode)[0]
  }, name)
}

function row(name: string) {
  return editor.page.getByTestId('variable-row').filter({ hasText: name })
}

test('a timing reads and edits in milliseconds and is stored in seconds', async () => {
  await expect(row('fast')).toContainText('150ms')
  await row('fast').click()
  const field = editor.page.getByTestId('token-inspector').getByRole('spinbutton')
  await expect(field).toHaveValue('150')
  await field.fill('250')
  await field.press('Enter')
  await expect.poll(() => stored('fast')).toBe(0.25)
  await expect(row('fast')).toContainText('250ms')
})

test('an easing opens Figma’s editor, where presets, handles and the bezier field edit it', async () => {
  await expect(row('standard')).toContainText('Ease in and out')
  await row('standard').click()
  await editor.page.getByTestId('easing-field').click()
  const easingEditor = editor.page.getByTestId('easing-editor')
  await expect(easingEditor).toBeVisible()
  await expect(easingEditor.getByTestId('easing-bezier')).toHaveValue('0.42, 0, 0.58, 1')

  await easingEditor.getByTestId('easing-handle-first').press('ArrowUp')
  await expect
    .poll(() => stored('standard'))
    .toEqual({ easing: 'CUSTOM_CUBIC', bezier: { x1: 0.42, y1: 0.01, x2: 0.58, y2: 1 } })

  await easingEditor.getByTestId('easing-bezier').fill('0.42, 0, 1, 1')
  await easingEditor.getByTestId('easing-bezier').press('Enter')
  await expect.poll(() => stored('standard')).toMatchObject({ easing: 'EASE_IN' })
  await easingEditor.getByTestId('easing-flip').click()
  await expect.poll(() => stored('standard')).toMatchObject({ easing: 'OUT_CUBIC' })

  await easingEditor.getByRole('button', { name: 'Spring', exact: true }).click()
  await expect.poll(() => stored('standard')).toMatchObject({ easing: 'GENTLE_SPRING' })
  await easingEditor.getByTestId('easing-handle-bounce').press('ArrowUp')
  await expect
    .poll(() => stored('standard'))
    .toEqual({ easing: 'CUSTOM_SPRING', spring: { stiffness: 100, damping: 14.8, mass: 1 } })
  await expect(row('standard')).toContainText('spring(0.26)')
  editor.canvas.assertNoErrors()
})
