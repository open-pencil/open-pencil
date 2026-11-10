import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test(`inline effect settings in ${theme}`, async ({ page }) => {
    await page.goto('/?test')
    await new CanvasHelper(page).waitForInit()
    const id = await page.evaluate(async (mode) => {
      const path = '/src/app/shell/theme.ts'
      const module = await import(path)
      module.useAppTheme().setTheme(mode)
      const editor = window.openPencil?.getStore?.()
      if (!editor) throw new Error('Editor unavailable')
      const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
      editor.updateNode(id, {
        effects: [
          {
            type: 'DROP_SHADOW',
            color: { r: 0, g: 0, b: 0, a: 0.25 },
            offset: { x: 0, y: 4 },
            radius: 12,
            spread: 0,
            visible: true
          }
        ]
      })
      editor.select([id])
      return id
    }, theme)
    const section = page.getByRole('region', { name: 'Effects', exact: true })
    await section.getByRole('button', { name: 'Expand effect settings' }).click()
    if (theme === 'light') await expect(section).toHaveScreenshot('inline-shadow-light.png')
    const radius = section.getByRole('spinbutton', { name: 'Blur', exact: true })
    await radius.focus()
    await radius.fill('20')
    await radius.press('Enter')
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects[0].radius,
          id
        )
      )
      .toBe(20)
    await section.getByRole('heading', { name: 'Effects' }).click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
    await expect
      .poll(() =>
        page.evaluate(
          (id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects[0].radius,
          id
        )
      )
      .toBe(12)
    await section.getByRole('combobox', { name: 'Effects', exact: true }).click()
    await page.getByRole('option', { name: 'Layer blur', exact: true }).click()
    await expect(section.getByRole('spinbutton', { name: 'Blur', exact: true })).toBeVisible()
    await section.getByRole('button', { name: 'Remove effect' }).click()
    await expect
      .poll(() =>
        page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects, id)
      )
      .toEqual([])
    await expect(section.locator('[data-slot="effect-settings"]')).toHaveCount(0)
  })
}

test('bind a shadow’s blur and colour to variables, and detach by typing', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
    editor.updateNode(id, {
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 12,
          spread: 0,
          visible: true
        }
      ]
    })
    editor.select([id])
    return id
  })
  const node = () =>
    page.evaluate((id) => {
      const layer = window.openPencil?.getStore?.().graph.getNode(id)
      return { bindings: layer?.boundVariables, radius: layer?.effects[0].radius }
    }, id)
  const section = page.getByRole('region', { name: 'Effects', exact: true })
  await section.getByRole('button', { name: 'Expand effect settings' }).click()

  const blur = section.locator('[data-property="effects/0/radius"]')
  await blur.getByRole('button', { name: 'Apply variable' }).click()
  await page.getByRole('button', { name: 'Create number variable from 12', exact: true }).click()
  await page.getByPlaceholder('Variable name').fill('Shadow/Blur')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(blur).toHaveAttribute('data-bound')
  await expect
    .poll(async () => (await node()).bindings)
    .toEqual({ 'effects/0/radius': expect.any(String) })

  const colour = section.locator('[data-property="effect-color"]')
  await expect(colour.getByRole('spinbutton', { name: 'Opacity' })).toBeVisible()
  await colour.getByRole('button', { name: 'Apply variable' }).click()
  await page
    .getByRole('button', { name: 'Create color variable from #000000', exact: true })
    .click()
  await page.getByPlaceholder('Variable name').fill('Shadow/Color')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(colour).toContainText('Shadow/Color')
  // A bound colour takes its opacity from the variable.
  await expect(colour.getByRole('spinbutton', { name: 'Opacity' })).toHaveCount(0)
  await expect
    .poll(async () => Object.keys((await node()).bindings ?? {}).sort())
    .toEqual(['effects/0/color', 'effects/0/radius'])

  const radius = section.getByRole('spinbutton', { name: 'Blur', exact: true })
  await radius.focus()
  const input = blur.locator('input')
  await input.fill('24')
  await input.press('Enter')
  await expect
    .poll(node)
    .toEqual({ bindings: { 'effects/0/color': expect.any(String) }, radius: 24 })
  await expect(blur).not.toHaveAttribute('data-bound')
})

test('switch an effect to Glass and edit its labelled settings', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(async () => {
    const path = '/src/app/shell/theme.ts'
    const module = await import(path)
    module.useAppTheme().setTheme('light')
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
    editor.updateNode(id, {
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 12,
          spread: 0,
          visible: true
        }
      ]
    })
    editor.select([id])
    return id
  })
  const glass = () =>
    page.evaluate((id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects[0], id)
  const section = page.getByRole('region', { name: 'Effects', exact: true })
  await section.getByRole('button', { name: 'Expand effect settings' }).click()
  await section.getByRole('combobox', { name: 'Effects', exact: true }).click()
  await page.getByRole('option', { name: 'Glass', exact: true }).click()
  await expect.poll(async () => (await glass())?.type).toBe('GLASS')

  for (const label of ['Light angle', 'Light intensity', 'Refraction', 'Depth', 'Dispersion']) {
    await expect(section.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(section.getByText('Frost', { exact: true })).toBeVisible()
  await expect(section).toHaveScreenshot('inline-glass-light.png')

  const depth = section.getByRole('spinbutton', { name: 'Depth', exact: true })
  await depth.focus()
  await depth.fill('12')
  await depth.press('Enter')
  await expect.poll(async () => (await glass())?.glass?.depth).toBe(12)
})

test('a drop shadow shows behind transparent areas until unchecked', async ({ page }) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  const id = await page.evaluate(() => {
    const editor = window.openPencil?.getStore?.()
    if (!editor) throw new Error('Editor unavailable')
    const id = editor.createShape('RECTANGLE', 100, 100, 180, 120)
    editor.updateNode(id, {
      effects: [
        {
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 12,
          spread: 0,
          visible: true
        }
      ]
    })
    editor.select([id])
    return id
  })
  const showBehind = () =>
    page.evaluate(
      (id) => window.openPencil?.getStore?.().graph.getNode(id)?.effects[0].showShadowBehindNode,
      id
    )
  const section = page.getByRole('region', { name: 'Effects', exact: true })
  await section.getByRole('button', { name: 'Expand effect settings' }).click()
  const checkbox = section.getByRole('checkbox', { name: 'Show behind transparent areas' })
  await expect(checkbox).toBeChecked()
  await checkbox.click()
  await expect(checkbox).not.toBeChecked()
  await expect.poll(showBehind).toBe(false)
  await section.getByRole('heading', { name: 'Effects' }).click()
  await expect(checkbox).not.toBeFocused()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(checkbox).toBeChecked()
})
