import { strict as assert } from 'node:assert'

import {
  createNativeTextFixture,
  readNativeEditorSnapshot
} from '#tests/helpers/tauri/editor-snapshot'
import { withNativeEventRecorder } from '#tests/helpers/tauri/event-recorder'

describe('native text editing', () => {
  it('commits ordinary WebView input exactly once', async () => {
    await createNativeTextFixture('Replace me')
    const textarea = await $('textarea[aria-hidden="true"]')
    await textarea.waitForExist()

    await withNativeEventRecorder(async (recorder) => {
      await recorder.clear()
      await textarea.click()
      await textarea.addValue('Typed once')
      await browser.waitUntil(
        async () => (await readNativeEditorSnapshot()).editingText === 'Typed once',
        { timeout: 10_000, timeoutMsg: 'Native text input did not reach the graph' }
      )

      const snapshot = await readNativeEditorSnapshot()
      const events = await recorder.read()

      assert.equal(snapshot.editingText, 'Typed once')
      assert.equal(snapshot.editingNodeExists, true)
      assert.equal(snapshot.textNodeCount, 1)
      assert.ok(
        events.some((event) => ['beforeinput', 'input', 'keydown', 'keyup'].includes(event.type)),
        'expected a WebDriver input or keyboard event'
      )
      assert.equal(
        events.filter((event) => event.type === 'input').length,
        1,
        'WebDriver text insertion must produce one input event'
      )
    })
  })

  it('reuses the open document when preparing another text fixture', async () => {
    const tabCount = await browser.execute(() => document.querySelectorAll('[role="tab"]').length)
    const id = await createNativeTextFixture('Another fixture')
    const snapshot = await readNativeEditorSnapshot()

    assert.equal(snapshot.editingTextId, id)
    assert.equal(snapshot.editingText, 'Another fixture')
    assert.equal(snapshot.textNodeCount, 1)
    assert.equal(
      await browser.execute(() => document.querySelectorAll('[role="tab"]').length),
      tabCount
    )
  })
})
