import { describe, expect, test } from 'bun:test'

import { createPinchReplay, type ShellPinch } from '@/app/shell/wheel/pinch'

type Received = { target: string; type: string; scale: number; clientX: number; bubbles: boolean }

function surfaces(received: Received[]) {
  const at = (name: string) => {
    const target = new EventTarget()
    target.addEventListener('gesturestart', (event) => record(name, event))
    target.addEventListener('gesturechange', (event) => record(name, event))
    target.addEventListener('gestureend', (event) => record(name, event))
    return target
  }
  function record(target: string, event: Event) {
    const { scale, clientX } = event as Event & { scale: number; clientX: number }
    received.push({ target, type: event.type, scale, clientX, bubbles: event.bubbles })
  }
  return { canvas: at('canvas'), panel: at('panel') }
}

function pinch(phase: ShellPinch['phase'], scale: number, clientX: number): ShellPinch {
  return { phase, scale, clientX, clientY: 10 }
}

describe('shell pinch replay', () => {
  test('sends every phase of a pinch to what was under its start, as gesture events', () => {
    const received: Received[] = []
    const { canvas, panel } = surfaces(received)
    const replay = createPinchReplay((x) => (x < 100 ? panel : canvas))

    replay(pinch('gesturestart', 1, 300))
    replay(pinch('gesturechange', 1.5, 50))
    replay(pinch('gestureend', 1.5, 50))

    expect(received).toEqual([
      { target: 'canvas', type: 'gesturestart', scale: 1, clientX: 300, bubbles: true },
      { target: 'canvas', type: 'gesturechange', scale: 1.5, clientX: 50, bubbles: true },
      { target: 'canvas', type: 'gestureend', scale: 1.5, clientX: 50, bubbles: true }
    ])
  })

  test('hit-tests again for the next pinch and drops one that starts over nothing', () => {
    const received: Received[] = []
    const { panel } = surfaces(received)
    const replay = createPinchReplay((x) => (x < 100 ? panel : null))

    replay(pinch('gesturestart', 1, 300))
    replay(pinch('gesturechange', 2, 300))
    replay(pinch('gestureend', 2, 300))
    replay(pinch('gesturestart', 1, 50))

    expect(received.map(({ target, type }) => `${target} ${type}`)).toEqual(['panel gesturestart'])
  })
})
