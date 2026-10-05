import { CHECKABLE } from './checked'
import { documentPartFrame, withinFrame } from './parts'
import type { PlayControl, PlayInteraction, PlayKey } from './types'

function flip(control: PlayControl): void {
  const checked = CHECKABLE[control.target.behaviour.kind]
  checked?.set(control, !checked.get(control))
}

const activates = (key: PlayKey) => key.key === ' ' || key.key === 'Enter'

/** Toggle, switch, and checkbox: a press, Space, or Enter flips the value. */
export const toggle: PlayInteraction = {
  press(pointer) {
    flip(pointer)
    return false
  },
  key(key) {
    if (!activates(key)) return false
    flip(key)
    return true
  }
}

/** Collapsible: pressing its trigger, or Space and Enter, shows or hides its content. */
export const collapsible: PlayInteraction = {
  press(pointer) {
    const trigger = documentPartFrame(pointer.graph, pointer.target, 'trigger')
    if (withinFrame(pointer.graph, trigger, pointer.hitId)) flip(pointer)
    return false
  },
  key(key) {
    if (!activates(key)) return false
    flip(key)
    return true
  },
  restore(control) {
    const open = CHECKABLE.collapsible
    const stored = open?.stored(control)
    if (open && stored !== undefined) open.set(control, stored)
  }
}

/** Radio: a press, Space, or Enter turns it on; only its group turns it off. */
export const radio: PlayInteraction = {
  press(pointer) {
    CHECKABLE.radio?.set(pointer, true)
    return false
  },
  key(key) {
    if (!activates(key)) return false
    CHECKABLE.radio?.set(key, true)
    return true
  }
}
