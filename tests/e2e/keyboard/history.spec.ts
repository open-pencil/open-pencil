import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { getPageChildren } from '#tests/helpers/store'

const editor = useEditorSetup()

async function getPageChildCount() {
  return (await getPageChildren(editor.page)).length
}

test.describe('undo/redo', () => {
  test('⌘Z undoes last action', async () => {
    await editor.canvas.clearCanvas()
    await editor.canvas.drawRect(100, 100, 60, 60)
    expect(await getPageChildCount()).toBe(1)

    await editor.page.keyboard.press('ControlOrMeta+z')
    await editor.canvas.waitForRender()

    expect(await getPageChildCount()).toBe(0)
  })

  test('⌘⇧Z redoes undone action', async () => {
    await editor.canvas.clearCanvas()
    await editor.canvas.drawRect(100, 100, 60, 60)
    await editor.page.keyboard.press('ControlOrMeta+z')
    await editor.canvas.waitForRender()
    expect(await getPageChildCount()).toBe(0)

    await editor.page.keyboard.press('ControlOrMeta+Shift+z')
    await editor.canvas.waitForRender()

    expect(await getPageChildCount()).toBe(1)
  })
})

test.describe('undo/redo across keyboard layouts', () => {
  // Playwright cannot type one character from another key, so each press goes through CDP with
  // the character a layout types and the physical key it sits on.
  const presses = [
    { layout: 'QWERTZ', label: 'Z', key: 'z', code: 'KeyY', shift: false, action: 'undo' },
    { layout: 'QWERTZ', label: 'Shift+Z', key: 'Z', code: 'KeyY', shift: true, action: 'redo' },
    { layout: 'QWERTZ', label: 'Y', key: 'y', code: 'KeyZ', shift: false, action: 'redo' },
    { layout: 'AZERTY', label: 'Z', key: 'z', code: 'KeyW', shift: false, action: 'undo' },
    { layout: 'Russian', label: 'Я', key: 'я', code: 'KeyZ', shift: false, action: 'undo' },
    { layout: 'Russian', label: 'Shift+Я', key: 'Я', code: 'KeyZ', shift: true, action: 'redo' }
  ] as const

  for (const { layout, label, key, code, shift, action } of presses) {
    test(`${layout} mod+${label} runs ${action}`, async () => {
      await editor.canvas.clearCanvas()
      await editor.canvas.drawRect(100, 100, 60, 60)
      await editor.canvas.drawRect(200, 100, 60, 60)
      await editor.page.keyboard.press('ControlOrMeta+z')
      await editor.canvas.waitForRender()
      expect(await getPageChildCount()).toBe(1)

      const cdp = await editor.page.context().newCDPSession(editor.page)
      const modifiers = (process.platform === 'darwin' ? 4 : 2) | (shift ? 8 : 0)
      for (const type of ['rawKeyDown', 'keyUp'] as const) {
        await cdp.send('Input.dispatchKeyEvent', { type, key, code, modifiers })
      }
      await cdp.detach()
      await editor.canvas.waitForRender()

      expect(await getPageChildCount()).toBe(action === 'undo' ? 0 : 2)
    })
  }
})
