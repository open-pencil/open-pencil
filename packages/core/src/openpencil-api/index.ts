import { omit } from 'es-toolkit'

import {
  BEHAVIOUR_CONTRACTS,
  BEHAVIOUR_KINDS,
  parseVariableFormula,
  type BehaviourKind,
  type BehaviourSpec
} from '@open-pencil/scene-graph'

import type { FigmaAPI } from '#core/figma-api/index'

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
import { getStatus, listStatuses, setStatus, type StatusInfo } from './statuses'

export { BehaviourHandle, type NodeRef } from './behaviours'
export type { StatusInfo } from './statuses'
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

  /**
   * Set a numeric or Boolean token formula by collection, variable and optional mode names.
   * References use `{variable/name}` or `{Collection::variable/name}` and persist by ID.
   */
  setVariableFormula(
    collectionName: string,
    variableName: string,
    source: string,
    modeName?: string
  ): number | boolean {
    const graph = this.figma.graph
    const collections = [...graph.variableCollections.values()].filter(
      (item) => item.name === collectionName
    )
    const collection = collections.at(0)
    if (!collection || collections.length !== 1)
      throw new Error(`Unknown or ambiguous collection: ${collectionName}`)
    const variables = [...graph.variables.values()].filter(
      (item) => item.collectionId === collection.id && item.name === variableName
    )
    const variable = variables.at(0)
    if (!variable || variables.length !== 1)
      throw new Error(`Unknown or ambiguous variable: ${variableName}`)
    const modes = collection.modes.filter((mode) =>
      modeName ? mode.name === modeName : mode.modeId === collection.defaultModeId
    )
    const mode = modes.at(0)
    if (!mode || modes.length !== 1) throw new Error(`Unknown or ambiguous mode: ${modeName}`)
    const { value, resolved } = parseVariableFormula(graph, variable.id, mode.modeId, source)
    this.figma.setVariableValue(variable.id, mode.modeId, value)
    // Match the inspector: a live formula supersedes this mode's CSS-only expression.
    if (variable.expressions) {
      variable.expressions = omit(variable.expressions, [mode.modeId])
      if (Object.keys(variable.expressions).length === 0) delete variable.expressions
    }
    return resolved
  }

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

  /**
   * The document's statuses, such as Ready for dev or the team's own Approved, with each one's
   * color and the status Figma shows for it, if any.
   */
  get statuses(): StatusInfo[] {
    return listStatuses(this.figma.graph)
  }

  /** The name of the status a section, frame, component, set or instance shows, or null. */
  getStatus(node: NodeRef): string | null {
    return getStatus(this.figma.graph, node)
  }

  /**
   * Give a layer one of the document's statuses by name, or clear it with null. Only sections,
   * frames, components, sets and instances directly on a page or in a section take one.
   */
  setStatus(node: NodeRef, status: string | null): void {
    setStatus(this.figma.graph, node, status)
  }
}
