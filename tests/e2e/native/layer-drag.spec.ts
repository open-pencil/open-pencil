import { strict as assert } from 'node:assert'

import {
  createNativeLayerFixture,
  readNativeLayerOrder
} from '#tests/helpers/tauri/editor-snapshot'
import { withNativeEventRecorder } from '#tests/helpers/tauri/event-recorder'
import { nativeDrag, readElementClientGeometry } from '#tests/helpers/tauri/windows-input'

describe('native layer dragging', () => {
  it('delivers a WebView drag sequence and reorders once', async function () {
    if (process.platform !== 'win32') this.skip()
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    const ids = await createNativeLayerFixture()
    const source = await $(`[data-node-id="${ids.third}"] [data-test-id="layers-item"]`)
    const target = await $(`[data-node-id="${ids.first}"] [data-test-id="layers-item"]`)
    await source.waitForExist()
    await target.waitForExist()

    await withNativeEventRecorder(async (recorder) => {
      await recorder.clear()
      const sourceGeometry = await readElementClientGeometry(
        `[data-node-id="${ids.third}"] [data-test-id="layers-item"]`
      )
      const targetGeometry = await readElementClientGeometry(
        `[data-node-id="${ids.first}"] [data-test-id="layers-item"]`
      )
      await nativeDrag(
        {
          x: sourceGeometry.x + Math.round(sourceGeometry.width / 2),
          y: sourceGeometry.y + Math.round(sourceGeometry.height / 2)
        },
        {
          x: targetGeometry.x + Math.round(targetGeometry.width / 2),
          y: targetGeometry.y + 2
        }
      )
      await browser.pause(1_000)

      const events = await recorder.read()
      const order = await readNativeLayerOrder()
      assert.deepEqual(order, [ids.third, ids.first, ids.second])
      assert.ok(
        events.some((event) => event.type === 'pointerdown'),
        'expected pointerdown'
      )
      assert.ok(
        events.some((event) => event.type === 'dragstart'),
        'expected dragstart'
      )
      assert.ok(
        events.some((event) => event.type === 'dragover'),
        'expected dragover'
      )
      assert.ok(
        events.some((event) => event.type === 'drop'),
        'expected drop'
      )
      assert.ok(
        events.some((event) => event.type === 'dragend'),
        'expected dragend'
      )
      assert.ok(
        events
          .filter((event) =>
            ['pointerdown', 'dragstart', 'dragover', 'drop', 'dragend'].includes(event.type)
          )
          .every((event) => event.isTrusted),
        'native drag events should be trusted'
      )
    })
  })
})
