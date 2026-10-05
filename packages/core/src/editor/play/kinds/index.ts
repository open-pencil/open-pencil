import type { BehaviourKind } from '@open-pencil/scene-graph'

import { button } from './button'
import { slider } from './slider'
import { tabs } from './tabs'
import { toggle } from './toggle'
import type { PlayInteraction } from './types'

export type { PlayControl, PlayInteraction, PlayKey, PlayPointer } from './types'

/** How each kind of control answers the pointer in preview. */
export const PLAY_INTERACTIONS: Readonly<Record<BehaviourKind, PlayInteraction>> = {
  button,
  switch: toggle,
  checkbox: toggle,
  slider,
  tabs
}
