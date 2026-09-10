import type { Transition } from 'motion-v'

/** Motion uses seconds; CSS timing remains in the owning theme treatment. */
export const motionTransitions = {
  immediate: { duration: 0 },
  quick: { duration: 0.15 },
  layout: { type: 'spring', damping: 30, stiffness: 500 }
} as const satisfies Record<string, Transition>

export function resolveMotionTransition(enabled: boolean, transition: Transition): Transition {
  return enabled ? transition : motionTransitions.immediate
}
