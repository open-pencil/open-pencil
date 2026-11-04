import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'
import { boundFieldDriver } from '#tests/helpers/properties/bound-field-driver'

// Figma desktop 126: right-clicking the Appearance eye binds visibility to a boolean or text
// variable; a component layer's own button also lists its boolean properties. While a variable
// decides visibility the eye is disabled, and detaching keeps the visibility it last gave.

const editor = useEditorSetupWithClear('/?test')
const visibility = boundFieldDriver(() => editor.page)

function appearance() {
  return editor.page.getByRole('region', { name: 'Appearance', exact: true })
}

test('right-clicking the eye binds visibility to a text variable that decides it', async () => {
  const scene = await visibility.build()
  const eye = appearance().getByRole('button', { name: 'Toggle visibility' })
  await expect(appearance().getByRole('button', { name: 'Apply variable/property' })).toHaveCount(0)

  await eye.dispatchEvent('contextmenu')
  const picker = editor.page.getByRole('dialog', { name: 'Apply variable' })
  await expect(picker.getByRole('option')).toHaveText([/show-icon\s*true/, /state\s*yes/])
  await picker.getByRole('option', { name: /state/ }).click()

  const bound = appearance().getByRole('group', { name: 'Visibility' })
  await expect(eye).toBeDisabled()
  await expect(bound).toContainText(/state\s*yes/)
  for (const [text, visible] of [
    ['no', false],
    ['On', true],
    ['', false]
  ] as const) {
    await visibility.setText(text)
    expect(await visibility.layer(scene.plain)).toMatchObject({ visible, variable: scene.state })
  }

  await bound.getByRole('button', { name: 'Detach variable' }).click()
  expect(await visibility.layer(scene.plain)).toMatchObject({
    visible: false,
    variable: undefined,
    property: undefined
  })
  await expect(eye).toBeEnabled()
})

test('a component layer picks a property or a variable, one at a time', async () => {
  const scene = await visibility.build()
  await visibility.select('componentLayer')
  const apply = appearance().getByRole('button', { name: 'Apply variable/property' })
  const picker = editor.page.getByRole('dialog', { name: 'Apply variable/property' })

  await apply.click()
  await picker.getByRole('option', { name: /show-icon/ }).click()
  expect((await visibility.layer(scene.componentLayer)).variable).toBe(scene.flag)

  await apply.click()
  await picker.getByRole('button', { name: 'Create property…' }).click()
  const { property, variable } = await visibility.layer(scene.componentLayer)
  expect(property).toBeDefined()
  expect(variable).toBeUndefined()

  await apply.click()
  await expect(picker.getByRole('group', { name: 'Properties in Button' })).toBeVisible()
  await picker.getByRole('option', { name: /show-icon/ }).click()
  expect(await visibility.layer(scene.componentLayer)).toMatchObject({
    variable: scene.flag,
    property: undefined
  })

  await editor.page.keyboard.press('ControlOrMeta+z')
  await expect
    .poll(() => visibility.layer(scene.componentLayer))
    .toMatchObject({ variable: undefined, property })
})
