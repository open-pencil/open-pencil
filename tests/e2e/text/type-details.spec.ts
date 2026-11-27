import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

/** Opens the editor with one Inter text selected, and returns its id. */
async function selectedText(page: Page): Promise<string> {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  return page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('TEXT', 120, 120, 300, 40)
    store.updateNode(id, { text: 'Hello world 0123', fontSize: 24 })
    store.select([id])
    return id
  })
}

function textNode(page: Page, id: string) {
  return page.evaluate((nodeId) => {
    const node = window.openPencil?.getStore?.().graph.getNode(nodeId)
    if (!node) throw new Error('text not found')
    return {
      textDecoration: node.textDecoration,
      textDecorationStyle: node.textDecorationStyle,
      textDecorationThickness: node.textDecorationThickness,
      textDecorationFills: node.textDecorationFills,
      leadingTrim: node.leadingTrim,
      fontFeatures: node.fontFeatures,
      styleRuns: node.styleRuns
    }
  }, id)
}

function undo(page: Page) {
  return page.evaluate(() => window.openPencil?.getStore?.().undoAction())
}

test.describe('typography details', () => {
  test('underline settings show while the text is underlined', async ({ page }) => {
    const id = await selectedText(page)
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

    const underlined = await textNode(page, id)
    expect(underlined.textDecoration).toBe('UNDERLINE')
    expect(underlined.textDecorationStyle).toBe('WAVY')
    expect(underlined.textDecorationThickness).toBeGreaterThan(0)
    expect(underlined.textDecorationFills).toHaveLength(1)
    await expect(typography.getByRole('button', { name: 'Remove decoration color' })).toBeVisible()

    await undo(page)
    expect((await textNode(page, id)).textDecorationFills).toEqual([])

    await typography.getByRole('button', { name: /^Underline/ }).click()
    await expect(settings).toHaveCount(0)
  })

  test('vertical trim sets cap height to baseline, and undoes', async ({ page }) => {
    const id = await selectedText(page)
    const typography = page.getByRole('region', { name: 'Typography' })
    await typography.getByRole('combobox', { name: 'Vertical trim' }).click()
    await page.getByRole('option', { name: 'Cap height to baseline' }).click()
    expect((await textNode(page, id)).leadingTrim).toBe('CAP_HEIGHT')
    await undo(page)
    expect((await textNode(page, id)).leadingTrim).toBe('NONE')
  })

  test('the link field links the text, rejects what is not a link, and removes the link', async ({
    page
  }) => {
    const id = await selectedText(page)
    const typography = page.getByRole('region', { name: 'Typography' })
    const field = typography.getByRole('textbox', { name: 'Link' })

    await field.fill('not a link')
    await field.press('Enter')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    expect((await textNode(page, id)).styleRuns).toEqual([])

    await field.fill('openpencil.dev')
    await field.press('Enter')
    const link = { type: 'URL', value: 'https://openpencil.dev' }
    expect((await textNode(page, id)).styleRuns).toEqual([
      { start: 0, length: 16, style: { hyperlink: link } }
    ])
    await expect(field).toHaveValue('https://openpencil.dev')

    await typography.getByRole('button', { name: 'Remove link' }).click()
    await expect(field).toHaveValue('')
  })

  test('Mod+K while editing links the selected characters', async ({ page }) => {
    const id = await selectedText(page)
    await page.evaluate((nodeId) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')
      store.startTextEditing(nodeId)
      const state = store.textEditor?.state
      if (!state) throw new Error('not editing')
      state.selectionAnchor = 6
      state.cursor = 11
      store.textSelectionChanged()
    }, id)
    const field = page
      .getByRole('region', { name: 'Typography' })
      .getByRole('textbox', { name: 'Link' })

    await page.keyboard.press('ControlOrMeta+k')
    await expect(field).toBeFocused()
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0)
    await field.fill('openpencil.dev')
    await field.press('Enter')
    expect((await textNode(page, id)).styleRuns).toEqual([
      {
        start: 6,
        length: 5,
        style: { hyperlink: { type: 'URL', value: 'https://openpencil.dev' } }
      }
    ])
  })

  test("more features lists the font's own and turns them on", async ({ page }) => {
    const id = await selectedText(page)
    const typography = page.getByRole('region', { name: 'Typography' })
    await typography.getByRole('button', { name: 'More features' }).click()
    const features = page.locator('[data-property="font-features"]')
    await expect(features).toBeVisible()

    await features.getByRole('switch', { name: 'Open digits' }).click()
    await features.getByRole('combobox', { name: 'Number style' }).click()
    await page.getByRole('option', { name: 'Tabular lining' }).click()

    expect((await textNode(page, id)).fontFeatures).toEqual([
      { tag: 'SS01', enabled: true },
      { tag: 'TNUM', enabled: true },
      { tag: 'LNUM', enabled: true }
    ])
    await expect(features.getByRole('switch', { name: 'Open digits' })).toBeChecked()
  })

  test('small caps stay off for a font without them', async ({ page }) => {
    await selectedText(page)
    const typography = page.getByRole('region', { name: 'Typography' })
    await typography.getByRole('combobox', { name: 'Text case' }).click()
    await expect(page.getByRole('option', { name: 'Small caps', exact: true })).toBeDisabled()
    await expect(page.getByRole('option', { name: 'Forced small caps' })).toBeDisabled()
  })
})
