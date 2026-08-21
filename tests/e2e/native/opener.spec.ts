import { strict as assert } from 'node:assert'

const TEST_URL = 'https://cloud.example.test/cloud/device?user_code=ABCD-EFGH'

describe('native external opener', () => {
  it('captures system-browser URLs without launching a browser in native tests', async () => {
    const opened = await browser.execute(async (url) => {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('take_native_test_opened_urls')
      await invoke('open_external_url', { url })
      return invoke<string[]>('take_native_test_opened_urls')
    }, TEST_URL)

    assert.deepEqual(opened, [TEST_URL])

    const drained = await browser.execute(async () => {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<string[]>('take_native_test_opened_urls')
    })
    assert.deepEqual(drained, [])
  })
})
