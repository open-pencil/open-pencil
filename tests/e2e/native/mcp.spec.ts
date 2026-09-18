import { strict as assert } from 'node:assert'
import { readFileSync, renameSync } from 'node:fs'

import { invokeNative } from '#tests/helpers/tauri/invoke'

interface DiscoveryFile {
  httpPort: number
  authToken: string
}

const NOT_INSTALLED = 'MCP automation is not installed'

async function openMCPSettings(): Promise<void> {
  // The platform shortcut is how the existing native settings spec opens Settings.
  await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
  await browser.waitUntil(
    () =>
      browser.execute(() =>
        Boolean(document.querySelector('[data-test-id="app-settings-dialog"]'))
      ),
    { timeout: 10_000, timeoutMsg: 'Settings did not open' }
  )
  await (await $('[data-test-id="settings-section-mcp"]')).click()
  await browser.waitUntil(
    () =>
      browser.execute(() =>
        Boolean(document.querySelector('[data-test-id="settings-mcp-automation-panel"]'))
      ),
    { timeout: 10_000, timeoutMsg: 'MCP settings panel did not render' }
  )
}

function mcpStatus(): Promise<string | null> {
  return browser.execute(
    () =>
      document
        .querySelector<HTMLElement>(
          '[data-test-id="settings-mcp-automation-panel"] [role="status"]'
        )
        ?.textContent?.trim() ?? null
  )
}

function mcpAlert(): Promise<string | null> {
  return browser.execute(
    () =>
      document
        .querySelector<HTMLElement>(
          '[data-test-id="settings-mcp-failure"] [data-slot="alert-heading"]'
        )
        ?.textContent?.trim() ?? null
  )
}

/** Expand the failure disclosure and read the technical payload. */
function mcpFailureDetail(): Promise<string | null> {
  return browser.executeAsync((done) => {
    document
      .querySelector<HTMLElement>('[data-test-id="settings-mcp-failure-details"] button')
      ?.click()
    requestAnimationFrame(() => {
      done(
        document
          .querySelector<HTMLElement>('[data-test-id="settings-mcp-failure-detail"]')
          ?.textContent?.trim() ?? null
      )
    })
  })
}

/**
 * Restart is offered by the healthy-state button and by the failure alert, so
 * click whichever one is currently rendered.
 */
function clickRestart(): Promise<void> {
  return browser.execute(() => {
    const panel = document.querySelector<HTMLElement>(
      '[data-test-id="settings-mcp-automation-panel"]'
    )
    for (const button of panel?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
      if (button.textContent?.includes('MCP server') && button.offsetParent !== null) {
        button.click()
        return
      }
    }
  })
}

async function waitForStatus(expected: string): Promise<void> {
  try {
    await browser.waitUntil(async () => (await mcpStatus()) === expected, { timeout: 30_000 })
  } catch {
    throw new Error(
      `MCP status was "${await mcpStatus()}" instead of "${expected}"; ` +
        `alert "${await mcpAlert()}"; detail "${await mcpFailureDetail()}"`
    )
  }
}

describe('native MCP server lifecycle', () => {
  // Native specs share one app process, which remembers the open Settings
  // section. Restore General before closing so the next spec finds it.
  afterEach(async () => {
    await browser.execute(() => {
      document.querySelector<HTMLElement>('[data-test-id="settings-section-general"]')?.click()
      document.querySelector<HTMLElement>('[data-test-id="app-settings-done"]')?.click()
    })
    await browser.waitUntil(
      () => browser.execute(() => !document.querySelector('[data-test-id="app-settings-dialog"]')),
      { timeout: 10_000, timeoutMsg: 'Settings did not close after the MCP spec' }
    )
  })

  it('uses the server it resolves, or reports why it cannot', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    await openMCPSettings()

    // The app resolves the binary through the PATH it derives from the login
    // shell, so assert what it resolved rather than injecting a fixture.
    const lookup = await invokeNative<{ available: boolean; path: string | null }>('mcp_lookup')

    if (!lookup.available || !lookup.path) {
      // Without a global install the reason must be the install itself.
      await waitForStatus('Error')
      assert.equal(await mcpAlert(), NOT_INSTALLED)
      return
    }

    // A resolvable binary either becomes healthy, or is refused with a reason.
    await browser.waitUntil(async () => (await mcpStatus()) !== 'Starting', { timeout: 30_000 })
    if ((await mcpStatus()) === 'Error') {
      const detail = await mcpFailureDetail()
      assert.match(
        detail ?? '',
        /requires @open-pencil\/mcp|major\.minor compatibility/,
        `resolved ${lookup.path} but failed without a version explanation: ${detail}`
      )
      return
    }

    await waitForStatus('Running')
    const discoveryPath = process.env.OPENPENCIL_MCP_DISCOVERY_PATH
    assert.ok(discoveryPath, 'discovery path missing from the wdio configuration')
    const discovery = JSON.parse(readFileSync(discoveryPath, 'utf8')) as DiscoveryFile
    assert.ok(discovery.authToken, 'discovery file omitted the auth token')

    // The spawned server serves the app: real port, real token.
    const health = await fetch(`http://127.0.0.1:${discovery.httpPort}/health`, {
      headers: { authorization: `Bearer ${discovery.authToken}` }
    })
    assert.equal(health.status, 200)
    assert.equal(((await health.json()) as { status: string }).status, 'ok')

    // Hiding the resolved binary must report the missing install, and restoring
    // it must recover without relaunching the app.
    const hidden = `${lookup.path}.native-test-hidden`
    renameSync(lookup.path, hidden)
    try {
      await clickRestart()
      await browser.waitUntil(async () => (await mcpAlert()) === NOT_INSTALLED, {
        timeout: 30_000,
        timeoutMsg: `MCP failure alert was: ${await mcpAlert()}`
      })
    } finally {
      renameSync(hidden, lookup.path)
    }

    await clickRestart()
    await waitForStatus('Running')
  })
})
