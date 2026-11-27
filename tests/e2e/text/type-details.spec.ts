import { expect, test } from '@playwright/test'

import { typeDetailsDriver } from '#tests/helpers/properties/type-details-driver'

test.describe('typography details', () => {
  test('underline settings show while the text is underlined', async ({ page }) => {
    const text = typeDetailsDriver(page)
    await text.open()
    const typography = page.getByRole('region', { name: 'Typography' })
    const settings = typography.locator('[data-property="decoration-settings"]')
    await expect(settings).toHaveCount(0)

    await typography.getByRole('button', { name: /^Underline/ }).click()
    await expect(settings).toBeVisible()

    await typography.getByRole('combobox', { name: 'Underline style' }).click()
    await page.getByRole('option', { name: 'Wavy' }).click()
    await typography.getByRole('combobox', { name: 'Thickness mode' }).click()
    await page.getByRole('option', { name: 'Fixed' }).click()
    await typography.getByRole('button', { name: 'Add decoration color' }).click()

    const underlined = await text.details()
    expect(underlined.textDecoration).toBe('UNDERLINE')
    expect(underlined.textDecorationStyle).toBe('WAVY')
    expect(underlined.textDecorationThickness).toBeGreaterThan(0)
    expect(underlined.textDecorationFills).toHaveLength(1)
    await expect(typography.getByRole('button', { name: 'Remove decoration color' })).toBeVisible()

    await text.undo()
    expect((await text.details()).textDecorationFills).toEqual([])

    await typography.getByRole('button', { name: /^Underline/ }).click()
    await expect(settings).toHaveCount(0)
  })

  test('vertical trim sets cap height to baseline, and undoes', async ({ page }) => {
    const text = typeDetailsDriver(page)
    await text.open()
    const typography = page.getByRole('region', { name: 'Typography' })
    await typography.getByRole('combobox', { name: 'Vertical trim' }).click()
    await page.getByRole('option', { name: 'Cap height to baseline' }).click()
    expect((await text.details()).leadingTrim).toBe('CAP_HEIGHT')
    await text.undo()
    expect((await text.details()).leadingTrim).toBe('NONE')
  })

  test('the link field links the text, rejects what is not a link, and removes the link', async ({
    page
  }) => {
    const text = typeDetailsDriver(page)
    await text.open()
    const typography = page.getByRole('region', { name: 'Typography' })
    const field = typography.getByRole('textbox', { name: 'Link' })

    await field.fill('not a link')
    await field.press('Enter')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    expect((await text.details()).styleRuns).toEqual([])

    await field.fill('openpencil.dev')
    await field.press('Enter')
    const link = { type: 'URL', value: 'https://openpencil.dev' }
    expect((await text.details()).styleRuns).toEqual([
      { start: 0, length: 16, style: { hyperlink: link } }
    ])
    await expect(field).toHaveValue('https://openpencil.dev')

    await typography.getByRole('button', { name: 'Remove link' }).click()
    await expect(field).toHaveValue('')
  })

  test('Mod+K while editing links the selected characters', async ({ page }) => {
    const text = typeDetailsDriver(page)
    await text.open()
    await text.selectCharacters(6, 11)
    const field = page
      .getByRole('region', { name: 'Typography' })
      .getByRole('textbox', { name: 'Link' })

    await page.keyboard.press('ControlOrMeta+k')
    await expect(field).toBeFocused()
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0)
    await field.fill('openpencil.dev')
    await field.press('Enter')
    expect((await text.details()).styleRuns).toEqual([
      {
        start: 6,
        length: 5,
        style: { hyperlink: { type: 'URL', value: 'https://openpencil.dev' } }
      }
    ])
  })

  test("more features lists the font's own and turns them on", async ({ page }) => {
    const text = typeDetailsDriver(page)
    await text.open()
    const typography = page.getByRole('region', { name: 'Typography' })
    await typography.getByRole('button', { name: 'More features' }).click()
    const features = page.locator('[data-property="font-features"]')
    await expect(features).toBeVisible()

    await features.getByRole('switch', { name: 'Open digits' }).click()
    await features.getByRole('combobox', { name: 'Number style' }).click()
    await page.getByRole('option', { name: 'Tabular lining' }).click()

    expect((await text.details()).fontFeatures).toEqual([
      { tag: 'SS01', enabled: true },
      { tag: 'TNUM', enabled: true },
      { tag: 'LNUM', enabled: true }
    ])
    await expect(features.getByRole('switch', { name: 'Open digits' })).toBeChecked()
  })

  test('small caps stay off for a font without them', async ({ page }) => {
    await typeDetailsDriver(page).open()
    const typography = page.getByRole('region', { name: 'Typography' })
    await typography.getByRole('combobox', { name: 'Text case' }).click()
    await expect(page.getByRole('option', { name: 'Small caps', exact: true })).toBeDisabled()
    await expect(page.getByRole('option', { name: 'Forced small caps' })).toBeDisabled()
  })
})
