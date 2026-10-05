import { playControl, type PlayTarget } from '#core/editor/play/session'

import { CHECKABLE, type PlayChecked } from './checked'
import { arrowIndex } from './keys'
import { documentPartFrame, partItemIndex, withinFrame } from './parts'
import type { PlayControl, PlayInteraction, PlayKey } from './types'

interface GroupItem {
  control: PlayControl
  checked: PlayChecked
}

interface GroupOptions {
  /** Whether pressing the item that is on turns it off, leaving none on. */
  deselect: boolean
  /** Only a press on this part of an item uses it, such as an accordion item's trigger. */
  itemPart?: string
  /** Whether arrows move to the next or previous item, as in a radio group. */
  arrows?: boolean
}

/** The group's items, in slot order: the instances in its items slot that are on or off. */
function items({ graph, session, target }: PlayControl): (GroupItem | null)[] {
  const frame = documentPartFrame(graph, target, 'items')
  return (frame?.childIds ?? []).map((id) => {
    const node = graph.getNode(id)
    const item: PlayTarget | null = node ? playControl(graph, node) : null
    const checked = item ? CHECKABLE[item.behaviour.kind] : undefined
    return item && checked ? { control: { graph, session, target: item }, checked } : null
  })
}

/**
 * A group of items with one on at most, like a radio group, a single toggle group, or an
 * accordion: using an item turns it on and the others off.
 */
export function itemGroup(options: GroupOptions): PlayInteraction {
  function choose(control: PlayControl, index: number): void {
    const list = items(control)
    const chosen = list[index]
    if (!chosen || control.session.isDisabled(chosen.control.target)) return
    const on = !(options.deselect && chosen.checked.get(chosen.control))
    // The group is copied first, so its items' copies are the ones it draws.
    control.session.edit(control.target, () => {
      for (const [position, item] of list.entries()) {
        const wanted = position === index && on
        if (item && item.checked.get(item.control) !== wanted)
          item.checked.set(item.control, wanted)
      }
    })
  }

  function step(control: PlayKey): boolean {
    const list = items(control)
    const count = list.length
    if (!options.arrows || count === 0) return false
    const current = Math.max(
      0,
      list.findIndex((item) => item?.checked.get(item.control))
    )
    const index = arrowIndex(control.key, current, count)
    if (index === undefined) return false
    choose(control, index)
    return true
  }

  return {
    press(pointer) {
      const index = partItemIndex(pointer.graph, pointer.target, 'items', pointer.hitId)
      const item = index === null ? null : items(pointer)[index]
      if (index === null || !item) return false
      const part = options.itemPart
        ? documentPartFrame(pointer.graph, item.control.target, options.itemPart)
        : undefined
      if (!options.itemPart || withinFrame(pointer.graph, part, pointer.hitId))
        choose(pointer, index)
      return false
    },
    key: step,
    restore(control) {
      for (const item of items(control)) {
        const stored = item?.checked.stored(item.control)
        if (item && stored !== undefined) item.checked.set(item.control, stored)
      }
    }
  }
}
