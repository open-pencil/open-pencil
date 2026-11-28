import { listen } from '@tauri-apps/api/event'
import { tryOnScopeDispose } from '@vueuse/core'

import { IS_TAURI } from '@/constants'

type GesturePhase = 'gesturestart' | 'gesturechange' | 'gestureend'

/** A touchpad pinch the Linux desktop shell takes from WebKitGTK (`desktop/src/pinch.rs`). */
export type ShellPinch = { phase: GesturePhase; scale: number; clientX: number; clientY: number }

/**
 * Replays pinches as the gesture events WebKit sends on macOS. Like a real gesture, every phase
 * goes to what was under the pointer when the pinch began, so a pinch that starts over a panel
 * never zooms a canvas.
 */
export function createPinchReplay(
  elementAt: (clientX: number, clientY: number) => EventTarget | null
): (pinch: ShellPinch) => void {
  let target: EventTarget | null = null
  return ({ phase, scale, clientX, clientY }) => {
    if (phase === 'gesturestart') target = elementAt(clientX, clientY)
    const event = new Event(phase, { bubbles: true, cancelable: true })
    target?.dispatchEvent(Object.assign(event, { scale, rotation: 0, clientX, clientY }))
    if (phase === 'gestureend') target = null
  }
}

/** Zooms the canvas, through its gesture handler, with the Linux desktop's touchpad pinches. */
export function useShellPinchGestures(): void {
  if (!IS_TAURI) return
  const replay = createPinchReplay((x, y) => document.elementFromPoint(x, y))
  const subscription = listen<ShellPinch>('canvas-pinch', ({ payload }) => replay(payload))
  tryOnScopeDispose(() => void subscription.then((unlisten) => unlisten()))
}
