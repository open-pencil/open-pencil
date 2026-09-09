import { strict as assert } from 'node:assert'

import { invokeNative } from '#tests/helpers/tauri/invoke'

const reference = { integrationId: 'native-test', profileId: 'isolation', field: 'api-key' }

describe('native test credential isolation', () => {
  it('uses disposable memory credentials and exposes explicit retry without Keychain access', async function () {
    this.timeout(180_000)
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000 }
    )
    const previousLaunch = await browser.execute(() => {
      // Probe the WebView itself, not an adapter, to verify profile isolation.
      // oxlint-disable-next-line open-pencil/no-direct-storage-access
      const previous = localStorage.getItem('native-test-launch-marker')
      // oxlint-disable-next-line open-pencil/no-direct-storage-access
      localStorage.setItem('native-test-launch-marker', 'present')
      return previous
    })
    assert.equal(previousLaunch, null)
    assert.equal(await $('[role="alertdialog"]').isExisting(), false)
    await invokeNative('credential_retry_access')
    assert.equal(await invokeNative('credential_status', { reference }), 'missing')
    await invokeNative('credential_write', { reference, value: 'disposable-test-value' })
    assert.equal(await invokeNative('credential_status', { reference }), 'configured')
    await invokeNative('credential_remove', { reference })
    assert.equal(await invokeNative('credential_status', { reference }), 'missing')
  })

  it('hides credential controls when native access is healthy', async () => {
    await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
    const section = await $('[data-test-id="settings-general-panel"]')
    await section.waitForDisplayed()
    assert.doesNotMatch(
      await section.getText(),
      /system credential store|Saved passwords and API keys/
    )
    assert.equal(await $('button=Retry access').isExisting(), false)
  })

  it('shows a paused section after denial and hides it after retry', async function () {
    this.timeout(180_000)
    await assert.rejects(
      invokeNative('credential_write', { reference, value: 'open-pencil-native-test-denied' })
    )
    assert.equal(await $('[data-test-id="settings-general-panel"]').isDisplayed(), true)
    const retry = await $('button=Retry access')
    await retry.waitForExist()
    await retry.scrollIntoView()
    await browser.execute(() => {
      const panel = document.querySelector('[data-test-id="settings-general-panel"]')
      if (panel?.parentElement) panel.parentElement.scrollTop = panel.parentElement.scrollHeight
    })
    await retry.click()
    await browser.waitUntil(async () => !(await $('button=Retry access').isExisting()))
    assert.equal(await invokeNative('credential_access_paused'), false)
    await invokeNative('credential_write', { reference, value: 'disposable' })
    await invokeNative('credential_remove', { reference })
  })
})
