import type { VariableLiteral } from '@open-pencil/scene-graph'
import {
  BEHAVIOUR_CONTRACTS,
  BEHAVIOUR_KINDS,
  type BehaviourKind,
  type BehaviourSpec
} from '@open-pencil/scene-graph/behaviours'
import type { OkHCLColor, OkHCLPayload } from '@open-pencil/scene-graph/color'
import { parseVariableFormula } from '@open-pencil/scene-graph/variables'

import { exposeInstanceSwap } from '#core/figma-api/components'
import type { FigmaAPI, FigmaNodeProxy } from '#core/figma-api/index'
import { writeVariableValue } from '#core/figma-api/variables'
import { documentFontStatus, type DocumentFontStatus } from '#core/text/font/status'

import {
  getBehaviour,
  makeSlot,
  nodeOf,
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
import {
  readFillOkHCL,
  readLayoutDirection,
  readStrokeOkHCL,
  readTextDirection,
  writeFillOkHCL,
  writeLayoutDirection,
  writeStrokeOkHCL,
  writeTextDirection,
  writeTextMarkdown
} from './nodes'
import { getStatus, listStatuses, setStatus, type StatusInfo } from './statuses'
import { bindVariable, unbindVariable, type VariableRef } from './variables'

export { BehaviourHandle, type NodeRef } from './behaviours'
export type { StatusInfo } from './statuses'
export type { VariableRef } from './variables'
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
   * Set a token formula by collection, variable and optional mode names. References use
   * `{variable/name}` or `{Collection::variable/name}` and persist by ID; a true/false formula
   * can compare numbers, as in `{width} > 600 and not {loading}`, and `if()`, `text()` and
   * `truthy()` pick values, write text, and test text or numbers, as in
   * `if({compact}, "Hi", "Hello, " + {name})`.
   */
  setVariableFormula(
    collectionName: string,
    variableName: string,
    source: string,
    modeName?: string
  ): VariableLiteral {
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
    writeVariableValue(graph, variable, mode.modeId, value)
    return resolved
  }

  /**
   * Bind a layer field to a variable from `figma.variables`, as the layer panel does:
   * fields by OpenPencil's names, such as `'text'`, `'visible'`, `'opacity'` or `'fills/0/color'`.
   * Text content takes a text or number variable, a number shown as text; visibility takes a
   * boolean, or text that shows the layer unless it is empty or reads false, no or off.
   */
  bindVariable(node: NodeRef, field: string, variable: VariableRef): void {
    bindVariable(this.figma.graph, node, field, variable)
  }

  /** Let a layer field go of its variable, keeping the value the variable last gave it. */
  unbindVariable(node: NodeRef, field: string): void {
    unbindVariable(this.figma.graph, node, field)
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

  /**
   * Expose a swap on instances as one INSTANCE_SWAP property, offering the candidate components;
   * returns the layer that holds the property.
   */
  exposeInstanceSwap(
    instances: readonly NodeRef[],
    candidates: readonly NodeRef[],
    propertyName = 'Instance'
  ): FigmaNodeProxy {
    const proxies = (refs: readonly NodeRef[]) =>
      refs.map((ref) => this.figma.wrapNode(nodeOf(this.figma.graph, ref).id))
    const host = exposeInstanceSwap(
      this.figma.graph,
      proxies(instances),
      proxies(candidates),
      propertyName
    )
    return this.figma.wrapNode(host.id)
  }

  /**
   * Whether the current page's fonts are faithfully available: requested faces, where each
   * loaded from, substitutions, why an installed face could not load, and the layers affected.
   */
  getFontStatus(): DocumentFontStatus {
    return documentFontStatus(this.figma.graph, this.figma.currentPageId)
  }

  /** A fill's OkHCL color, which the color picker keeps beside its RGB, or null. */
  getFillOkHCL(node: NodeRef, index = 0): OkHCLPayload | null {
    return readFillOkHCL(this.figma.graph, node, index)
  }

  /** Set a fill's color in OkHCL; its RGB follows in the document's color space. */
  setFillOkHCL(node: NodeRef, color: OkHCLColor, index = 0): void {
    writeFillOkHCL(this.figma.graph, node, color, index)
  }

  getStrokeOkHCL(node: NodeRef, index = 0): OkHCLPayload | null {
    return readStrokeOkHCL(this.figma.graph, node, index)
  }

  setStrokeOkHCL(node: NodeRef, color: OkHCLColor, index = 0): void {
    writeStrokeOkHCL(this.figma.graph, node, color, index)
  }

  /** Which way a frame's auto layout runs: `AUTO`, `LTR` or `RTL`. */
  getLayoutDirection(node: NodeRef): string {
    return readLayoutDirection(this.figma.graph, node)
  }

  setLayoutDirection(node: NodeRef, direction: string): void {
    writeLayoutDirection(this.figma.graph, node, direction)
  }

  /** Which way a text runs: `AUTO`, `LTR` or `RTL`. */
  getTextDirection(node: NodeRef): string {
    return readTextDirection(this.figma.graph, node)
  }

  setTextDirection(node: NodeRef, direction: string): void {
    writeTextDirection(this.figma.graph, node, direction)
  }

  /**
   * Sets a text layer's text from Markdown, styled as FigJam styles Markdown typed into a text:
   * `#` and `##` headings bold at 2.5× and 1.5× the text's size, deeper ones bold at its size,
   * `**bold**`, `*italic*`, `~strike~`, `` `code` `` in Roboto Mono, links, lists, and quotes.
   * Load the fonts it uses first, as for `characters`.
   */
  setTextMarkdown(node: NodeRef, markdown: string): void {
    writeTextMarkdown(this.figma.graph, node, markdown)
  }
}
