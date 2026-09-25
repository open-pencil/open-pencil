import { strict as assert } from 'node:assert'

import { invokeNative } from '#tests/helpers/tauri/invoke'
import { nativeOSFacts } from '#tests/helpers/tauri/os'

describe('native support facts', () => {
  it('boots through the support gate into the editor', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    const notice = await browser.execute(() => Boolean(document.querySelector('#boot-notice')))
    assert.equal(notice, false)
  })

  it('reports the OS and WebView engine versions the support notice names', async () => {
    const { platform, version } = await nativeOSFacts()
    assert.ok(['macos', 'windows', 'linux'].includes(platform), `platform: ${platform}`)
    assert.match(version, /^\d+(\.\d+)*/)

    const webviewVersion = await invokeNative<string | null>('webview_version')
    assert.ok(webviewVersion, 'webview_version returned nothing')
    assert.match(webviewVersion, /\d+(\.\d+)+/)
  })
})
