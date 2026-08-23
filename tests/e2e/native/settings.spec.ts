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
    const initial = await browser.execute(async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<boolean>('native_menu_checked', { id: 'snap-objects' })
    })
    assert.equal(initial, true)

    await browser.executeAsync((done) => {
      const toggle = document.querySelector<HTMLElement>('[data-test-id="app-settings-trigger"]')
      toggle?.click()
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[data-test-id="settings-snap-objects"]')?.click()
        setTimeout(done, 200)
      })
    })
    const updated = await browser.execute(async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<boolean>('native_menu_checked', { id: 'snap-objects' })
    })
    assert.equal(updated, false)
  })
})
