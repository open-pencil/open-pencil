import { afterEach, describe, expect, test } from 'bun:test'

import { nextFrame } from '#vue/shared/frame'

const saved = {
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
  request: globalThis.requestAnimationFrame,
  cancel: globalThis.cancelAnimationFrame
}

/** A document a test can hide, as a browser hides a background tab. */
class TabDocument extends EventTarget {
  constructor(public visibilityState: DocumentVisibilityState) {
    super()
  }

  hide() {
    this.visibilityState = 'hidden'
    this.dispatchEvent(new Event('visibilitychange'))
  }
}

/** A page whose animation frames arrive only when the test draws one. */
function page(visibility: DocumentVisibilityState) {
  const tab = new TabDocument(visibility)
  Object.defineProperty(globalThis, 'document', { value: tab, configurable: true })
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
    tab,
    pending,
    draw() {
      for (const [id, callback] of [...pending]) {
        pending.delete(id)
        callback(0)
      }
    }
  }
}

/** Whether a promise has resolved once the callbacks already queued have run. */
async function settled(promise: Promise<void>): Promise<boolean> {
  let done = false
  void promise.then(() => {
    done = true
  })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

afterEach(() => {
  if (saved.document) Object.defineProperty(globalThis, 'document', saved.document)
  else Reflect.deleteProperty(globalThis, 'document')
  globalThis.requestAnimationFrame = saved.request
  globalThis.cancelAnimationFrame = saved.cancel
})

describe('waiting for the next frame', () => {
  test('resolves on the next frame in a tab on screen', async () => {
    const shown = page('visible')
    const frame = nextFrame()
    expect(await settled(frame)).toBe(false)
    shown.draw()
    expect(await settled(frame)).toBe(true)
  })

  // A hidden tab draws no frames; an open started there must not wait for the tab to be shown.
  test('resolves at once in a hidden tab', async () => {
    const hidden = page('hidden')
    expect(await settled(nextFrame())).toBe(true)
    expect(hidden.pending.size).toBe(0)
  })

  test('stops waiting when the tab is hidden, and drops the frame it asked for', async () => {
    const shown = page('visible')
    const frame = nextFrame()
    expect(await settled(frame)).toBe(false)
    shown.tab.hide()
    expect(await settled(frame)).toBe(true)
    expect(shown.pending.size).toBe(0)
  })
})
