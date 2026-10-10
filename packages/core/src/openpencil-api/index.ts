import {
  BEHAVIOUR_CONTRACTS,
  BEHAVIOUR_KINDS,
  type BehaviourKind,
  type BehaviourSpec
} from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api'

import {
  getBehaviour,
  makeSlot,
  setBehaviour,
  type BehaviourHandle,
  type NodeRef
} from './behaviours'
import {
  addComment,
  getComment,
  getComments,
  type CommentFilter,
  type CommentHandle,
  type NewComment
} from './comments'

export { BehaviourHandle, type NodeRef } from './behaviours'
export {
  CommentHandle,
  DEFAULT_COMMENT_AUTHOR,
  type CommentFilter,
  type NewComment
} from './comments'

/**
 * What OpenPencil adds to the Figma Plugin API for scripts, as the `openpencil` global next to
 * `figma`: features Figma has no API for, in the same style. It edits the same document as the
 * `figma` it is made for.
 */
export class OpenPencilAPI {
  constructor(private readonly figma: FigmaAPI) {}

  /** The behaviour kinds, after Reka UI's primitives, with the values and parts each binds. */
  get behaviourKinds() {
    return BEHAVIOUR_KINDS.map((kind) => ({ kind, ...structuredClone(BEHAVIOUR_CONTRACTS[kind]) }))
  }

  /** The behaviour a node's main component keeps, or null; a variant reads its set's. */
  getBehaviour(node: NodeRef): BehaviourHandle | null {
    return getBehaviour(this.figma.graph, node)
  }

  /**
   * Give a main component or component set a behaviour, replacing any it has: a kind alone, or
   * a spec naming its properties and slots, such as
   * `{ kind: 'switch', values: { value: 'State' }, parts: { thumb: 'Thumb' }, states: 'Interaction' }`.
   */
  setBehaviour(node: NodeRef, spec: BehaviourKind | BehaviourSpec): BehaviourHandle {
    return setBehaviour(this.figma.graph, node, spec)
  }

  /** Make a frame of a main component a slot, as Create slot does; returns the slot's name. */
  createSlot(frame: NodeRef): string {
    return makeSlot(this.figma.graph, frame)
  }

  /**
   * The document's comment threads, oldest first: all of them, or only resolved or open ones,
   * one page's, or those a person started or replied to, such as `{ resolved: false }`.
   */
  getComments(filter?: CommentFilter): CommentHandle[] {
    return getComments(this.figma.graph, filter)
  }

  getComment(id: string): CommentHandle | null {
    return getComment(this.figma.graph, id)
  }

  /**
   * Leave a comment pinned on a layer, `{ node }`, which it then follows, or at a point of a
   * page, `{ page, x, y }`; the current page by default. `author` names who wrote it.
   */
  addComment(text: string, options?: NewComment): CommentHandle {
    return addComment(this.figma.graph, this.figma.currentPageId, text, options)
  }
}
