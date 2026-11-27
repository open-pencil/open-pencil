import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { textSelectionDriver } from '#tests/helpers/canvas/text-selection/driver'

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
})

test('a colour variable applied to selected words colours only them', async ({ page }) => {
  const text = textSelectionDriver(() => page)
  await text.show()
  await text.selectWorld()

  const fill = page.getByRole('region', { name: 'Fill', exact: true })
  await fill.getByRole('button', { name: 'Apply variable' }).click()
  await page
    .getByRole('dialog', { name: 'Apply variable' })
    .getByRole('option', { name: /Accent/ })
    .click()

  await expect.poll(text.runs).toMatchObject([{ start: 6, length: 5 }])
  await expect
    .poll(async () => Object.keys((await text.runs())[0]?.style.boundVariables ?? {}))
    .toEqual(['fills/0/color'])
  expect(await text.layer()).toMatchObject({ boundVariables: {} })
  // The panel shows the selection bound to the variable.
  await expect(fill).toContainText('Accent')
})

test('a text style applied to selected words styles only them', async ({ page }) => {
  const text = textSelectionDriver(() => page)
  await text.show()
  await text.selectWorld()

  const typography = page.getByRole('region', { name: 'Typography' })
  await typography.getByRole('combobox', { name: 'Text style' }).click()
  await page.getByRole('option', { name: 'Heading', exact: true }).click()

  await expect
    .poll(text.runs)
    .toMatchObject([{ start: 6, length: 5, style: { textStyleId: 'style:heading', fontSize: 28 } }])
  expect(await text.layer()).toMatchObject({ textStyleId: null })
})
