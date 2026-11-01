import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { statusLabelCenter } from '#tests/helpers/canvas/status-labels'
import { propertySection } from '#tests/helpers/properties'
import { getSelectedNode } from '#tests/helpers/store'

const editor = useEditorSetup()

async function getSelectedPosition() {
  const { x, y } = expectDefined(await getSelectedNode(editor.page), 'selected layer')
  return { x, y }
}

test.describe('arrow key nudging', () => {
  test.beforeEach(async () => {
    await editor.canvas.clearCanvas()
    await editor.canvas.drawRect(100, 100, 60, 60)
  })

  test('moves the selection by one pixel, or ten with ⇧', async () => {
    const start = await getSelectedPosition()

    await editor.page.keyboard.press('ArrowRight')
    expect(await getSelectedPosition()).toEqual({ x: start.x + 1, y: start.y })

    await editor.page.keyboard.press('Shift+ArrowDown')
    expect(await getSelectedPosition()).toEqual({ x: start.x + 1, y: start.y + 10 })
  })

  test('leaves arrow keys to an open list instead of moving the selection', async () => {
    const start = await getSelectedPosition()
    const blendMode = propertySection(editor.page, 'Appearance').getByRole('combobox', {
      name: 'Blend mode'
    })

    await blendMode.click()
    await expect(editor.page.getByRole('listbox')).toBeVisible()
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowRight', 'ArrowRight']) {
      await editor.page.keyboard.press(key)
    }

    expect(await getSelectedPosition()).toEqual(start)
    await editor.page.keyboard.press('Escape')
    await expect(editor.page.getByRole('listbox')).toBeHidden()
  })

  test('leaves arrow keys to an open menu that took no focus', async () => {
    await editor.canvas.drawSection(300, 100, 240, 160)
    const section = expectDefined(await getSelectedNode(editor.page), 'section')
    await propertySection(editor.page, 'Status')
      .getByRole('combobox', { name: 'Add status' })
      .click()
    await editor.page.getByRole('option', { name: 'Ready for dev' }).click()
    await editor.canvas.waitForRender()
    const pill = await statusLabelCenter(editor.page, section.id)
    const canvasElement = editor.page.getByTestId('canvas-element')
    await canvasElement.focus()

    await editor.canvas.click(pill.x, pill.y)
    const menu = editor.page.getByTestId('status-label-menu')
    await expect(menu).toBeVisible()
    await expect(canvasElement).toBeFocused()
    await editor.page.keyboard.press('ArrowRight')
    await editor.page.keyboard.press('Shift+ArrowDown')

    expect(await getSelectedPosition()).toEqual({ x: section.x, y: section.y })
    await editor.page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })
})
