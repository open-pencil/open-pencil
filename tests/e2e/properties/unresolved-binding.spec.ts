import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

for (const theme of ['light', 'dark']) {
  test.describe(`unresolved bindings in ${theme}`, () => {
    test.use({
      storageState: async ({ baseURL }, use) => {
        if (!baseURL) throw new Error('Binding tests require a baseURL')
        await use({
          cookies: [],
          origins: [
            {
              origin: new URL(baseURL).origin,
              localStorage: [{ name: 'open-pencil:theme', value: theme }]
            }
          ]
        })
      }
    })
    test(`unresolved number binding remains recoverable in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 1200 })
      await page.goto('/?test')
      await new CanvasHelper(page).waitForInit()
      await page.evaluate(() => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Editor unavailable')
        const id = editor.createShape('TEXT', 100, 100, 240, 80)
        editor.updateNode(id, { text: 'Unavailable variable', fontSize: 24, letterSpacing: 2 })
        const collection = editor.graph.createCollection('Typography')
        const variable = editor.graph.createVariable(
          'Tracking/Missing alias',
          'FLOAT',
          collection.id,
          2
        )
        editor.graph.createVariable('Tracking/Replacement', 'FLOAT', collection.id, 6)
        editor.bindVariable(id, 'letterSpacing', variable.id)
        editor.updateVariableValue(variable.id, collection.defaultModeId, { aliasId: 'missing' })
        const color = editor.graph.createVariable('Paint/Unavailable', 'COLOR', collection.id, {
          r: 1,
          g: 0,
          b: 0,
          a: 1
        })
        editor.graph.createVariable('Paint/Replacement', 'COLOR', collection.id, {
          r: 0,
          g: 1,
          b: 0,
          a: 1
        })
        editor.updateNode(id, {
          strokes: [
            {
              color: { r: 0, g: 0, b: 0, a: 1 },
              weight: 1,
              opacity: 1,
              visible: true,
              align: 'CENTER'
            }
          ]
        })
        editor.bindVariable(id, 'fills/0/color', color.id)
        editor.bindVariable(id, 'strokes/0/color', color.id)
        editor.updateVariableValue(color.id, collection.defaultModeId, { aliasId: 'missing-color' })
        editor.select([id])
      })
      const section = page.getByRole('region', { name: 'Typography', exact: true })
      const field = section.locator('[data-property="letterSpacing"]')
      await expect(field.locator('[data-slot="pill"]')).toHaveAttribute('data-unresolved')
      await expect(field).toContainText('Tracking/Missing alias')
      for (const name of ['Fill', 'Stroke']) {
        const paint = page.getByRole('region', { name, exact: true })
        await expect(paint.locator('[data-slot="pill"][data-unresolved]')).toBeVisible()
        await expect(paint.locator('[data-property="opacity"]')).toContainText('100')
        if (theme === 'dark' && name === 'Fill')
          await expect(paint).toHaveScreenshot('unresolved-fill-dark.png')
        await paint.getByRole('button', { name: 'Apply variable' }).click()
        await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
        await expect(paint.locator('[data-slot="pill"]')).toHaveCount(0)
        await paint.getByRole('heading', { name, exact: true }).click()
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
        await expect(paint.locator('[data-slot="pill"]')).toHaveAttribute('data-unresolved')
        await paint.getByRole('button', { name: 'Apply variable' }).click()
        await page.getByRole('option', { name: 'Paint/Replacement' }).click()
        await expect(paint).toContainText('Paint/Replacement')
        await expect(paint.locator('[data-slot="pill"]')).not.toHaveAttribute('data-unresolved')
      }
      await field.getByRole('button', { name: 'Apply variable' }).click()
      await page.getByRole('button', { name: 'Detach variable', exact: true }).click()
      await expect(field.locator('[data-slot="pill"]')).toHaveCount(0)
      await section.getByRole('heading', { name: 'Typography', exact: true }).click()
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
      await expect(field.locator('[data-slot="pill"]')).toHaveAttribute('data-unresolved')
      await field.getByRole('button', { name: 'Apply variable' }).click()
      await page.getByRole('option', { name: 'Tracking/Replacement' }).click()
      await expect(field).toContainText('Tracking/Replacement')
      await expect(field.locator('[data-slot="pill"]')).not.toHaveAttribute('data-unresolved')
    })
  })
}
