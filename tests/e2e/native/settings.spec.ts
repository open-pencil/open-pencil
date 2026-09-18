import { strict as assert } from 'node:assert'

import { invokeNative } from '#tests/helpers/tauri/invoke'

function settingsOpen(): Promise<boolean> {
  return browser.execute(() =>
    Boolean(document.querySelector('[data-test-id="app-settings-dialog"]'))
  )
}

describe('native preferences', () => {
  it('opens Settings with the platform shortcut while an input is focused', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    await browser.execute(() => {
      const input = document.createElement('input')
      input.setAttribute('data-test-id', 'native-settings-shortcut-input')
      document.body.append(input)
    })
    const input = await $('[data-test-id="native-settings-shortcut-input"]')
    await input.click()
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
    await browser.waitUntil(settingsOpen, {
      timeout: 10_000,
      timeoutMsg: 'Native settings shortcut did not open Settings'
    })

    assert.equal(await settingsOpen(), true)
  })

  it('keeps native snapping checkmarks synchronized with preferences', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    const initial = await invokeNative<boolean>('native_menu_checked', { id: 'snap-objects' })
    assert.equal(initial, true)

    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
    await browser.waitUntil(settingsOpen, {
      timeout: 10_000,
      timeoutMsg: 'Settings did not open for the snapping checkmark test'
    })
    // Spec files share one app process, so select the section this test needs
    // instead of assuming the dialog opened on it.
    await (await $('[data-test-id="settings-section-general"]')).click()
    await (await $('[data-test-id="settings-snap-objects"]')).waitForDisplayed({ timeout: 10_000 })
    await (await $('[data-test-id="settings-snap-objects"]')).click()
    await browser.waitUntil(
      async () =>
        (await invokeNative<boolean>('native_menu_checked', { id: 'snap-objects' })) === false,
      { timeout: 5_000, timeoutMsg: 'Native snapping checkmark did not follow the preference' }
    )
    const updated = await invokeNative<boolean>('native_menu_checked', { id: 'snap-objects' })
    assert.equal(updated, false)
  })
})
