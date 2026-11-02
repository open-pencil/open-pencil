import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { layerHeader } from '#tests/helpers/properties'
import { boundFieldDriver } from '#tests/helpers/properties/bound-field-driver'

// Figma desktop 126: a text layer's content binds to a text or number variable, a number shown as
// text; a component's text layer also lists the component's text properties. Detaching keeps the
// text the variable last gave.

const editor = useEditorSetupWithClear('/?test')
const fields = boundFieldDriver(() => editor.page)

function header(name: string) {
  return layerHeader(editor.page, name)
}

function content() {
  return editor.page.getByRole('group', { name: 'Content' })
}

test('a plain text layer shows a number variable as its text', async () => {
  const scene = await fields.build()
  await fields.select('plainText')
  await header('Note').getByRole('button', { name: 'Apply variable to text content' }).click()
  const picker = editor.page.getByRole('dialog', { name: 'Apply variable' })
  await expect(picker.getByRole('option')).toHaveText([/state\s*yes/, /size\s*4/])
  await picker.getByRole('option', { name: /size/ }).click()

  const bound = content()
  await expect(bound).toContainText(/size\s*4/)
  await expect
    .poll(() => fields.layer(scene.plainText, 'TEXT'))
    .toMatchObject({
      text: '4',
      variable: scene.size
    })
  await fields.setSize(42.5)
  await expect.poll(async () => (await fields.layer(scene.plainText, 'TEXT')).text).toBe('42.50')

  await bound.getByRole('button', { name: 'Detach variable' }).click()
  expect(await fields.layer(scene.plainText, 'TEXT')).toMatchObject({
    text: '42.50',
    variable: undefined
  })
})

test('a component text layer picks a text property or a variable, one at a time', async () => {
  const scene = await fields.build()
  await fields.select('componentText')
  const apply = header('Caption').getByRole('button', { name: 'Apply variable/property' })
  const picker = editor.page.getByRole('dialog', { name: 'Apply variable/property' })

  await apply.click()
  await picker.getByRole('button', { name: 'Create property…' }).click()
  const property = (await fields.layer(scene.componentText, 'TEXT')).property
  expect(property).toBeDefined()

  await apply.click()
  await expect(picker.getByRole('group', { name: 'Properties in Button' })).toBeVisible()
  await picker.getByRole('option', { name: /state/ }).click()
  await expect
    .poll(() => fields.layer(scene.componentText, 'TEXT'))
    .toMatchObject({
      text: 'yes',
      variable: scene.state,
      property: undefined
    })

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(() => fields.layer(scene.componentText, 'TEXT'))
    .toMatchObject({ variable: undefined, property })
})
