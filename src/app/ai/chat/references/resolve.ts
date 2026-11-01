import type { SceneNode } from '@open-pencil/scene-graph'

import { requestSkillSettings } from '@/app/ai/skills/settings/request'
import type { EditorStore } from '@/app/editor/active-store'
import { focusNodesOnTheirPage } from '@/app/editor/selection/focus'

import type { ChatReference } from './link'

/** A reference as the open document has it now. */
export interface ResolvedReference extends ChatReference {
  /** The target's current name, or the written label when it is gone or elsewhere. */
  name: string
  /** Whether it can be shown: the layer or page exists here, or the skill is known. */
  present: boolean
  /** A layer's node, for its icon. */
  node: SceneNode | null
}

/**
 * Resolves a reference against `store`, or only by its label when the conversation belongs to
 * another document (`store` is null) and its IDs are not this document's.
 */
export function resolveReference(
  store: Pick<EditorStore, 'graph'> | null,
  reference: ChatReference,
  skillNames: ReadonlySet<string>
): ResolvedReference {
  if (reference.kind === 'skill') {
    const present = skillNames.has(reference.id)
    return { ...reference, name: reference.id, present, node: null }
  }
  const node = store?.graph.getNode(reference.id)
  const fits = reference.kind === 'page' ? node?.type === 'CANVAS' : node && node.type !== 'CANVAS'
  if (!node || !fits) return { ...reference, name: reference.label, present: false, node: null }
  return {
    ...reference,
    name: node.name || reference.label,
    present: true,
    node: reference.kind === 'node' ? node : null
  }
}

/** Shows what a reference names: a layer on its page, a page, or a skill in Settings. */
export async function openReference(store: EditorStore, reference: ChatReference): Promise<void> {
  if (reference.kind === 'skill') requestSkillSettings(reference.id)
  else if (reference.kind === 'page') await store.switchPage(reference.id)
  else await focusNodesOnTheirPage(store, [reference.id])
}
