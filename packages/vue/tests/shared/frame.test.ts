import { afterEach, describe, expect, test } from 'bun:test'

import { nextTick, shallowRef } from 'vue'

import { nextFrame } from '#vue/shared/frame'

const saved = {
  request: globalThis.requestAnimationFrame,
  cancel: globalThis.cancelAnimationFrame
}

/**
 * A page whose animation frames arrive only when the test draws one, and which the test can
 * hide, as a browser hides a background tab.
 */
function page(initial: DocumentVisibilityState) {
  const visibility = shallowRef<DocumentVisibilityState>(initial)
  const pending = new Map<number, FrameRequestCallback>()
  let next = 0
  globalThis.requestAnimationFrame = (callback) => {
    pending.set(++next, callback)
    return next
  }
  globalThis.cancelAnimationFrame = (id) => {
    pending.delete(id)
  }
  return {
    visibility,
    pending,
    draw() {
      for (const [id, callback] of pending) {
        pending.delete(id)
        callback(0)
      }
    }
  }
}

/** Whether a promise has resolved once the callbacks already queued have run. */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false
  void promise.finally(() => {
    done = true
  })
  await nextTick()
  await Promise.resolve()
  return done
}

afterEach(() => {
  globalThis.requestAnimationFrame = saved.request
  globalThis.cancelAnimationFrame = saved.cancel
})

describe('waiting for the next frame', () => {
  test('resolves on the next frame in a tab on screen', async () => {
    const shown = page('visible')
    const frame = nextFrame({ visibility: shown.visibility })
    expect(await settled(frame)).toBe(false)
    shown.draw()
    expect(await settled(frame)).toBe(true)
  })

  // A hidden tab draws no frames; an open started there must not wait for the tab to be shown.
  test('resolves at once in a hidden tab', async () => {
    const hidden = page('hidden')
    expect(await settled(nextFrame({ visibility: hidden.visibility }))).toBe(true)
    expect(hidden.pending.size).toBe(0)
  })

  test('stops waiting when the tab is hidden, and drops the frame it asked for', async () => {
    const shown = page('visible')
    const frame = nextFrame({ visibility: shown.visibility })
    expect(await settled(frame)).toBe(false)
    shown.visibility.value = 'hidden'
    expect(await settled(frame)).toBe(true)
    expect(shown.pending.size).toBe(0)
  })

  test('resolves when the frame comes back at once, as a test double may run it', async () => {
    const visibility = shallowRef<DocumentVisibilityState>('visible')
    globalThis.requestAnimationFrame = (callback) => {
      callback(0)
      return 1
    }
    globalThis.cancelAnimationFrame = () => undefined
    expect(await settled(nextFrame({ visibility }))).toBe(true)
  })
})
