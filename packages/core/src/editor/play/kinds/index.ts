import type { BehaviourKind } from '#core/behaviours'

import { slider } from './slider'
import { tabs } from './tabs'
import { toggle } from './toggle'
import type { PlayInteraction } from './types'

export type { PlayInteraction, PlayPointer } from './types'

/** How each kind of control answers the pointer in preview. */
export const PLAY_INTERACTIONS: Readonly<Record<BehaviourKind, PlayInteraction>> = {
  switch: toggle,
  checkbox: toggle,
  slider,
  tabs
}
