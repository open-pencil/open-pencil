import { strict as assert } from 'node:assert'

const TEST_URL = 'https://cloud.example.test/cloud/device?user_code=ABCD-EFGH'

describe('native external opener', () => {
  it('captures system-browser URLs without launching a browser in native tests', async () => {
    const opened = await browser.tauri.execute(async ({ core }, url) => {
      await core.invoke('take_native_test_opened_urls')
      await core.invoke('open_external_url', { url })
      return core.invoke('take_native_test_opened_urls')
    }, TEST_URL)

    assert.deepEqual(opened, [TEST_URL])

    const drained = await browser.tauri.execute(({ core }) =>
      core.invoke('take_native_test_opened_urls')
    )
    assert.deepEqual(drained, [])
  })
})
