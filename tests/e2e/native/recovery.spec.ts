import { strict as assert } from 'node:assert'

function recoveryDialogExists(): Promise<boolean> {
  return browser.execute(() => Boolean(document.querySelector('[data-test-id="recovery-dialog"]')))
}

describe('native recovery policy', () => {
  it('starts without persistent recovery UI in native-test mode', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    assert.equal(await recoveryDialogExists(), false)
  })
})
