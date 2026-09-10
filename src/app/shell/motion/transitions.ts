import type { Transition } from 'motion-v'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'

import { animationsEnabled } from '@/app/shell/motion'
import { motionTransitions, resolveMotionTransition } from '@/theme/motion/transitions'

/** App adapter: presets stay store-free; this binds them to the effective motion policy. */
export function useMotionTransitions() {
  const quick = computed(() =>
    resolveMotionTransition(animationsEnabled.value, motionTransitions.quick)
  )
  const layout = computed(() => ({
    layout: resolveMotionTransition(animationsEnabled.value, motionTransitions.layout)
  }))
  return { quick, layout }
}

export function useMotionTransition(transition: MaybeRefOrGetter<Transition>) {
  return computed(() => resolveMotionTransition(animationsEnabled.value, toValue(transition)))
}
