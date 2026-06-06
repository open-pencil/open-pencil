import { expect, test } from '@playwright/test'

import { runA11yScan, expectNoCriticalViolations } from '#tests/helpers/a11y'
import { CanvasHelper } from '#tests/helpers/canvas'
import { waitForVisualReady } from '#tests/helpers/visual'

const editorChromeSelectors = [
  '[data-test-id="toolbar"]',
  '[data-test-id="layers-panel"]',
  '[data-test-id="properties-panel"]'
]

const editorExcludedSelectors = [
  '[data-test-id="canvas-area"]',
  '[data-test-id="canvas-loading"]',
  '[data-test-id="mention-loading"]'
]

const editorDisabledRules = [
  // TODO(cardene): `aria-required-children` in the properties tablist is tracked for a follow-up a11y fix PR.
  'aria-required-children',
  // TODO(cardene): `color-contrast` in editor chrome is tracked for a follow-up a11y fix PR.
  'color-contrast',
  // TODO(cardene): `label` on editor property inputs is tracked for a follow-up a11y fix PR.
  'label'
]

test.describe('editor accessibility', () => {
  test('default chrome has no critical accessibility violations', async ({ page }) => {
    const canvas = new CanvasHelper(page)

    await page.goto('/')
    await canvas.waitForInit()
    await expect(page.getByTestId('editor-root')).toBeVisible()
    await expect(page.getByTestId('toolbar')).toBeVisible()
    await expect(page.getByTestId('layers-panel')).toBeVisible()
    await expect(page.getByTestId('properties-panel')).toBeVisible()
    await waitForVisualReady(page, { canvas })

    const results = await runA11yScan(page, {
      include: editorChromeSelectors,
      exclude: editorExcludedSelectors,
      disableRules: editorDisabledRules
    })
    expectNoCriticalViolations(results)
    canvas.assertNoErrors()
  })

  test('selected-shape chrome has no critical accessibility violations', async ({ page }) => {
    const canvas = new CanvasHelper(page)

    await page.goto('/')
    await canvas.waitForInit()
    await canvas.drawRect(120, 120, 160, 120)
    await expect(page.getByTestId('design-panel-single')).toBeVisible()
    await waitForVisualReady(page, { canvas })

    const results = await runA11yScan(page, {
      include: editorChromeSelectors,
      exclude: editorExcludedSelectors,
      disableRules: editorDisabledRules
    })
    expectNoCriticalViolations(results)
    canvas.assertNoErrors()
  })
})
