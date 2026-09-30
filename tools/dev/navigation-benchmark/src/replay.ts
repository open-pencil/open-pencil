import type { Page } from '@playwright/test'

import type { NavigationRecordingFile, WheelSample } from './types'

export type ReplayMode = 'dom' | 'cdp'

async function waitUntil(startedAt: number, timeMs: number): Promise<void> {
  const elapsed = performance.now() - startedAt
  const delay = timeMs - elapsed
  if (delay > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, delay)
    })
  }
}

export async function replayDOM(page: Page, recording: NavigationRecordingFile): Promise<void> {
  await page.evaluate(async (samples: WheelSample[]) => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
    if (!canvas) throw new Error('Canvas element not found')
    const startedAt = performance.now()
    for (const sample of samples) {
      const delay = sample.timeMs - (performance.now() - startedAt)
      if (delay > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, delay)
        })
      }
      canvas.dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: sample.deltaX,
          deltaY: sample.deltaY,
          deltaMode: sample.deltaMode,
          ctrlKey: sample.ctrlKey,
          metaKey: sample.metaKey,
          shiftKey: sample.shiftKey,
          clientX: sample.clientX,
          clientY: sample.clientY,
          cancelable: sample.cancelable,
          bubbles: true
        })
      )
    }
  }, recording.wheel)
}

export async function replayCDP(page: Page, recording: NavigationRecordingFile): Promise<void> {
  const session = await page.context().newCDPSession(page)
  const startedAt = performance.now()
  const pending: Array<Promise<unknown>> = []
  try {
    for (const sample of recording.wheel) {
      await waitUntil(startedAt, sample.timeMs)
      let modifiers = 0
      if (sample.shiftKey) modifiers |= 8
      if (sample.ctrlKey) modifiers |= 2
      if (sample.metaKey) modifiers |= 4
      pending.push(
        session.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel',
          x: sample.clientX,
          y: sample.clientY,
          deltaX: sample.deltaX,
          deltaY: sample.deltaY,
          modifiers
        })
      )
    }
    await Promise.all(pending)
  } finally {
    await session.detach()
  }
}

export async function replay(
  page: Page,
  recording: NavigationRecordingFile,
  mode: ReplayMode
): Promise<void> {
  if (mode === 'dom') await replayDOM(page, recording)
  else await replayCDP(page, recording)
}
