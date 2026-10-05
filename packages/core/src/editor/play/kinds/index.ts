import type { BehaviourKind } from '@open-pencil/scene-graph'

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
