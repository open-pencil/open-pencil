import { partItemIndex } from './parts'
import type { PlayInteraction } from './types'

/** Tabs: pressing a trigger shows the content item at the same position. */
export const tabs: PlayInteraction = {
  press({ graph, session, target, hitId }) {
    const index = partItemIndex(graph, target, 'trigger', hitId)
    if (index === null) return false
    session.setChoice(target, 'value', index)
    session.edit(target, (copies, copy) => {
      const content = session.partFrame(target, copy, 'content')
      if (!content) return
      for (const [position, child] of copies.getChildren(content.id).entries())
        copies.updateNode(child.id, { visible: position === index })
    })
    return false
  }
}
