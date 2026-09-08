import { strict as assert } from 'node:assert'

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
    const initial = await browser.execute(
      () => window.openPencil?.getStore?.().state.snappingPreferences.objects
    )
    assert.equal(typeof initial, 'boolean')

    if (!(await settingsOpen())) {
      await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
      await browser.waitUntil(settingsOpen)
    }
    const snapping = $('[data-test-id="settings-snap-objects"]')
    await snapping.waitForExist()
    await snapping.click()
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => window.openPencil?.getStore?.().state.snappingPreferences.objects
        )) === !initial,
      { timeoutMsg: 'Snapping preference did not update' }
    )
    await browser.waitUntil(
      async () =>
        (await browser.tauri.execute(({ core }) =>
          core.invoke('native_menu_checked', { id: 'snap-objects' })
        )) === !initial,
      { timeoutMsg: 'Native snapping checkmark did not update' }
    )
    const updated = await browser.tauri.execute(({ core }) =>
      core.invoke('native_menu_checked', { id: 'snap-objects' })
    )
    assert.equal(updated, !initial)
  })
})
