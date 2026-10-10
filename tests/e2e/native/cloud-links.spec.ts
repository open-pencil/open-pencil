import { strict as assert } from 'node:assert'

import { invokeNative } from '#tests/helpers/tauri/invoke'

const SIGN_IN_URL = 'https://cloud.example.test/cloud/device?user_code=ABCD-EFGH'
const INVITATION = '0b6f4f9e-3c1a-4d7e-9a52-6f1c2d3e4f50'
// Shaped like a share secret, 64 hex characters, and obviously not one.
const SECRET = 'ab'.repeat(32)
// Nothing listens on the discard port, so the invitation's server cannot be reached.
const SERVER = 'http://127.0.0.1:9'

function invitationLink(secret: string): string {
  return `openpencil://cloud/invitations/${INVITATION}?server=${encodeURIComponent(SERVER)}#${secret}`
}

describe('native Cloud links', () => {
  before(async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000 }
    )
  })

  it('records browser links instead of opening a browser', async () => {
    await invokeNative('take_native_test_opened_urls')
    await invokeNative('open_external_url', { url: SIGN_IN_URL })
    assert.deepEqual(await invokeNative('take_native_test_opened_urls'), [SIGN_IN_URL])
    assert.deepEqual(await invokeNative('take_native_test_opened_urls'), [])
  })

  it('refuses to open links that are not web or mail addresses', async () => {
    await assert.rejects(invokeNative('open_external_url', { url: 'file:///etc/hosts' }))
    assert.deepEqual(await invokeNative('take_native_test_opened_urls'), [])
  })

  it('opens an invitation link sent to the app', async () => {
    await invokeNative('native_test_open_deep_link', { url: invitationLink(SECRET) })
    const dialog = await $('[role="dialog"]')
    await dialog.waitForDisplayed({ timeout: 15_000 })
    await browser.waitUntil(async () => /can’t be used/.test(await dialog.getText()), {
      timeout: 15_000,
      timeoutMsg: 'The invitation dialog did not report the unreachable server'
    })
    await browser.keys('Escape')
    await dialog.waitForDisplayed({ reverse: true })
  })

  it('ignores a Cloud link whose secret is malformed', async () => {
    await invokeNative('native_test_open_deep_link', { url: invitationLink('not-a-secret') })
    const pending = await invokeNative<unknown[]>('take_pending_cloud_links')
    assert.deepEqual(pending, [])
    assert.equal(await $('[role="dialog"]').isExisting(), false)
  })
})
