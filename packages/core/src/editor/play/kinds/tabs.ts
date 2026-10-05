import { documentPartFrame, partItemIndex } from './parts'
import type { PlayControl, PlayInteraction } from './types'

/** Show the content item at `index` and remember it as the chosen tab. */
function choose({ session, target }: PlayControl, index: number): void {
  session.setChoice(target, 'value', index)
  session.edit(target, (graph, copy) => {
    const content = session.partFrame(target, copy, 'content')
    if (!content) return
    for (const [position, child] of graph.getChildren(content.id).entries())
      graph.updateNode(child.id, { visible: position === index })
  })
}

/** Tabs: pressing a trigger, or arrowing along them, shows the content at the same position. */
export const tabs: PlayInteraction = {
  press(pointer) {
    const index = partItemIndex(pointer.graph, pointer.target, 'trigger', pointer.hitId)
    if (index !== null) choose(pointer, index)
    return false
  },
  key(control) {
    const count = documentPartFrame(control.graph, control.target, 'trigger')?.childIds.length ?? 0
    if (count === 0) return false
    const current = control.session.getChoice(control.target, 'value')
    const next = {
      ArrowRight: (current + 1) % count,
      ArrowDown: (current + 1) % count,
      ArrowLeft: (current - 1 + count) % count,
      ArrowUp: (current - 1 + count) % count,
      Home: 0,
      End: count - 1
    }[control.key as string]
    if (next === undefined) return false
    choose(control, next)
    return true
  },
  restore(control) {
    const index = control.session.changed(control.target, 'value')
    if (index !== undefined) choose(control, index)
  }
}
