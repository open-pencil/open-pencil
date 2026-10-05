import type { BehaviourKind } from '@open-pencil/scene-graph'

import { documentPartFrame } from './parts'
import type { PlayControl } from './types'

/** A control that is on or off, so a group can turn it on and off as one of its items. */
export interface PlayChecked {
  get(control: PlayControl): boolean
  set(control: PlayControl, on: boolean): void
  /** The value set in preview, or undefined while it is as designed. */
  stored(control: PlayControl): boolean | undefined
}

/** A control whose `value` is on or off: a toggle, switch, checkbox, or radio. */
const value: PlayChecked = {
  get: ({ session, target }) => session.getBoolean(target, 'value'),
  set: ({ session, target }, on) => session.setBoolean(target, 'value', on),
  stored: ({ session, target }) => session.changedBoolean(target, 'value')
}

/** A collapsible, open when its content shows; without a bound value it is as designed. */
const open: PlayChecked = {
  get: ({ graph, session, target }) =>
    session.getBoolean(target, 'open', documentPartFrame(graph, target, 'content')?.visible),
  set: ({ session, target }, on) => {
    session.setBoolean(target, 'open', on)
    session.edit(target, (graph, copy) => {
      const content = session.partFrame(target, copy, 'content')
      if (!content) return
      graph.updateNode(content.id, { visible: on })
      session.reflow(content.id)
    })
  },
  stored: ({ session, target }) => session.changedBoolean(target, 'open')
}

/** The kinds that are on or off, as items of a radio group, toggle group, or accordion. */
export const CHECKABLE: Partial<Record<BehaviourKind, PlayChecked>> = {
  toggle: value,
  switch: value,
  checkbox: value,
  radio: value,
  collapsible: open
}
