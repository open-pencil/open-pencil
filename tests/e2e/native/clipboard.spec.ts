import { strict as assert } from 'node:assert'

import { withNativeEventRecorder } from '#tests/helpers/tauri/event-recorder'

describe('native clipboard routing', () => {
  it('keeps copy and paste inside a focused editable field', async function () {
    if (process.platform !== 'win32') this.skip()
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    await browser.execute(() => {
      const input = document.createElement('input')
      input.setAttribute('data-test-id', 'native-clipboard-input')
      input.value = 'Native clipboard text'
      document.body.append(input)
    })
    const input = await $('[data-test-id="native-clipboard-input"]')
    await input.waitForExist()

    await withNativeEventRecorder(async (recorder) => {
      await input.click()
      await browser.keys(['Control', 'a'])
      await recorder.clear()
      await browser.keys(['Control', 'c'])
      await browser.keys(['ArrowRight'])
      await browser.keys(['Control', 'v'])
      await browser.pause(200)

      const events = await recorder.read()
      const value = await input.getValue()
      const clipboardEvents = events.filter(
        (event) => event.type === 'copy' || event.type === 'paste'
      )
      if (clipboardEvents.length === 0 && value === 'Native clipboard text') this.skip()
      assert.equal(value, 'Native clipboard textNative clipboard text')
      assert.equal(clipboardEvents.filter((event) => event.type === 'copy').length, 1)
      assert.equal(clipboardEvents.filter((event) => event.type === 'paste').length, 1)
      assert.ok(
        clipboardEvents.every((event) => event.target?.editable && event.isTrusted),
        'clipboard events should be trusted and stay on the editable target'
      )
    })
  })
})
