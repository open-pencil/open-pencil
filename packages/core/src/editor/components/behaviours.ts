import { readBehaviour, withBehaviour, type Behaviour } from '#core/behaviours'
import type { EditorContext } from '#core/editor/types'

function behaviourEditLabel(before: Behaviour | null, after: Behaviour | null): string {
  if (!after) return 'Remove behaviour'
  return before ? 'Edit behaviour' : 'Add behaviour'
}

export function createBehaviourActions(ctx: EditorContext) {
  /**
   * Set the behaviour a component or component set keeps, or remove it with null, as one undo
   * step. The panel composes the new behaviour; this only stores it.
   */
  function setBehaviour(ownerId: string, behaviour: Behaviour | null): void {
    const owner = ctx.graph.getNode(ownerId)
    if (!owner || (owner.type !== 'COMPONENT' && owner.type !== 'COMPONENT_SET')) return
    const before = structuredClone(owner.pluginData)
    const after = withBehaviour(owner, behaviour)
    const label = behaviourEditLabel(readBehaviour(owner), behaviour)
    const apply = (pluginData: typeof before) => {
      ctx.graph.updateNode(ownerId, { pluginData: structuredClone(pluginData) })
      ctx.requestRender()
    }
    apply(after)
    ctx.undo.push({ label, forward: () => apply(after), inverse: () => apply(before) })
  }

  return { setBehaviour }
}
