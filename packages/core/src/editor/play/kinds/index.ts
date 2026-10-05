import type { BehaviourKind } from '@open-pencil/scene-graph'

import { button } from './button'
import { itemGroup } from './group'
import { progress } from './progress'
import { slider } from './slider'
import { tabs } from './tabs'
import { collapsible, radio, toggle } from './toggle'
import type { PlayInteraction } from './types'

export type { PlayControl, PlayInteraction, PlayKey, PlayPointer } from './types'

/** How each kind of control answers the pointer and keyboard in preview. */
export const PLAY_INTERACTIONS: Readonly<Record<BehaviourKind, PlayInteraction>> = {
  button,
  toggle,
  switch: toggle,
  checkbox: toggle,
  radio,
  radioGroup: itemGroup({ deselect: false, arrows: true }),
  toggleGroup: itemGroup({ deselect: true }),
  slider,
  progress,
  tabs,
  collapsible,
  accordion: itemGroup({ deselect: true, itemPart: 'trigger' })
}
