import { readFileSync } from 'node:fs'

import * as v from 'valibot'

import type { RecordedWheelSample } from '@open-pencil/core/profiler'

import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup('/?test&no-chrome&no-rulers&renderer=tiled&navigation-benchmark')
const WheelSample: v.GenericSchema<unknown, RecordedWheelSample> = v.object({
  timeMs: v.number(),
  deltaX: v.number(),
  deltaY: v.number(),
  deltaMode: v.number(),
  ctrlKey: v.optional(v.boolean(), false),
  metaKey: v.optional(v.boolean(), false),
  shiftKey: v.optional(v.boolean(), false),
  clientX: v.number(),
  clientY: v.number(),
  cancelable: v.optional(v.boolean(), true),
  directionInvertedFromDevice: v.optional(v.boolean())
})
const GestureJSON = v.pipe(v.string(), v.parseJson(), v.object({ wheel: v.array(WheelSample) }))
const reversal = v.parse(
  GestureJSON,
  readFileSync('tests/fixtures/navigation/gestures/synthetic-repeated-pinch-reversal.json', 'utf8')
)

async function waitForTiledSettlement() {
  await editor.page.evaluate(() => window.openPencil?.test?.navigation?.waitForSettlement())
}

async function setLargeBlurRadius(radius: number) {
  await editor.page.evaluate((nextRadius) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const node = [...store.graph.getAllNodes()].find(
      (candidate) =>
        candidate.name === 'Group' &&
        candidate.width === 2100 &&
        candidate.height === 658 &&
        candidate.effects.some((effect) => effect.visible && effect.type === 'FOREGROUND_BLUR')
    )
    if (!node) throw new Error('Canonical large blur group not found')
    node.effects = node.effects.map((effect) =>
      effect.type === 'FOREGROUND_BLUR' ? { ...effect, radius: nextRadius } : effect
    )
    store.graph.updateNode(node.id, { effects: node.effects })
    store.clearSelection()
  }, radius)
}

async function replayReversal() {
  await editor.page.getByTestId('canvas-element').evaluate(async (canvas, samples) => {
    const startedAt = performance.now()
    for (const sample of samples) {
      const delay = sample.timeMs - (performance.now() - startedAt)
      if (delay > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay)
        })
      }
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: sample.deltaX,
          deltaY: sample.deltaY,
          deltaMode: sample.deltaMode,
          ctrlKey: sample.ctrlKey,
          metaKey: sample.metaKey,
          shiftKey: sample.shiftKey,
          clientX: sample.clientX,
          clientY: sample.clientY
        })
      )
    }
  }, reversal.wheel)
}

test('large blur remains seamless after tiled mutation and zoom reversal', async () => {
  test.setTimeout(120_000)
  await editor.page.evaluate(() =>
    window.openPencil?.openFile?.('/tests/fixtures/gold-preview.fig')
  )
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return (
      store != null &&
      store.state.preparation === null &&
      [...store.graph.getAllNodes()].some(
        (node) =>
          node.name === 'Group' &&
          node.width === 2100 &&
          node.height === 658 &&
          node.effects.some((effect) => effect.visible && effect.type === 'FOREGROUND_BLUR')
      )
    )
  })
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.zoomToFit()
  })
  await waitForTiledSettlement()

  await setLargeBlurRadius(210)
  await waitForTiledSettlement()
  editor.canvas.assertNoErrors()
  const settledMutation = await editor.canvas.canvas.screenshot()

  await setLargeBlurRadius(200)
  await waitForTiledSettlement()
  await setLargeBlurRadius(210)
  await replayReversal()
  await waitForTiledSettlement()
  editor.canvas.assertNoErrors()
  const settledAfterReversal = await editor.canvas.canvas.screenshot()
  expect(settledAfterReversal.equals(settledMutation)).toBe(true)
  expect(settledMutation).toMatchSnapshot('tiled-large-blur-mutation-settled.png')
})
