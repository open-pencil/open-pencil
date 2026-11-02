import { ref } from 'vue'

import type { Transition } from '@lawha/core/prototype'

/** Which prototype the player shows; `null` while it is closed. */
export interface PlayerSession {
  pageId: string
  start: string
}

export const playerSession = ref<PlayerSession | null>(null)

export function openPlayer(pageId: string, start: string): void {
  playerSession.value = { pageId, start }
}

export function closePlayer(): void {
  playerSession.value = null
}

const EASING: Record<NonNullable<Transition['easing']>, string> = {
  linear: 'linear',
  'ease-in': 'cubic-bezier(0.42, 0, 1, 1)',
  'ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
  'ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
}

type Keyframes = Keyframe[]

/** Where a screen starts when it comes in from `direction`, as a CSS translate. */
function offset(direction: Transition['direction'], amount = '100%'): string {
  switch (direction) {
    case 'right':
      return `translateX(-${amount})`
    case 'up':
      return `translateY(${amount})`
    case 'down':
      return `translateY(-${amount})`
    default:
      return `translateX(${amount})`
  }
}

function opposite(direction: Transition['direction']): Transition['direction'] {
  return { left: 'right', right: 'left', up: 'down', down: 'up' }[
    direction
  ] as Transition['direction']
}

/**
 * Keyframes for the incoming and outgoing screens. `direction` names the side the new screen
 * enters from (left = from the right edge moving left, as a forward swipe).
 */
export function transitionFrames(transition: Transition): {
  incoming: Keyframes
  outgoing: Keyframes
} {
  const dir = transition.direction
  switch (transition.type) {
    case 'dissolve':
      return { incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: [] }
    case 'smart-animate':
      return {
        incoming: [
          { opacity: 0, transform: 'scale(0.98)' },
          { opacity: 1, transform: 'scale(1)' }
        ],
        outgoing: [{ opacity: 1 }, { opacity: 0 }]
      }
    case 'slide-in':
      return {
        incoming: [{ transform: offset(dir) }, { transform: 'none' }],
        outgoing: [{ transform: 'none' }, { transform: offset(opposite(dir), '30%') }]
      }
    case 'move-in':
      return { incoming: [{ transform: offset(dir) }, { transform: 'none' }], outgoing: [] }
    case 'slide-out':
      return {
        incoming: [],
        outgoing: [{ transform: 'none' }, { transform: offset(opposite(dir)) }]
      }
    case 'push':
      return {
        incoming: [{ transform: offset(dir) }, { transform: 'none' }],
        outgoing: [{ transform: 'none' }, { transform: offset(opposite(dir)) }]
      }
    default:
      return { incoming: [], outgoing: [] }
  }
}

export function transitionTiming(transition: Transition): KeyframeAnimationOptions {
  return {
    duration: transition.type === 'instant' ? 0 : transition.duration,
    easing: EASING[transition.easing],
    fill: 'both'
  }
}

/** Slide out reveals the new screen underneath, so the old one stays on top while it leaves. */
export function outgoingOnTop(transition: Transition | null): boolean {
  return transition?.type === 'slide-out'
}
