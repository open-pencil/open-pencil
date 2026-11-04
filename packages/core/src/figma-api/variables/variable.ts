import { uniq } from 'es-toolkit/array'

import {
  VARIABLE_SCOPES,
  type CodeSyntaxPlatform,
  type SceneGraph,
  type Variable,
  type VariableCollection,
  type VariableScope,
  type VariableType,
  type VariableValue
} from '@open-pencil/scene-graph'
import { updateTokenExpression } from '@open-pencil/scene-graph/variables'

import { reconcileVariableLayouts } from '#core/layout/variables'

import { figmaVariableValue, storedVariableValue, type FigmaVariableValue } from './values'

/** Scopes as Figma's plugin API names them; the file calls a stroke colour scope `STROKE`. */
export type FigmaVariableScope =
  | Exclude<VariableScope, 'STROKE' | 'FONT_VARIATIONS' | 'TRANSFORM'>
  | 'STROKE_COLOR'

/** The plugin API lists no font variation or transform scope, so those stay unread. */
function figmaScope(scope: VariableScope): FigmaVariableScope[] {
  if (scope === 'STROKE') return ['STROKE_COLOR']
  if (scope === 'FONT_VARIATIONS' || scope === 'TRANSFORM') return []
  return [scope]
}

function documentScope(scope: FigmaVariableScope): VariableScope {
  if (scope === 'STROKE_COLOR') return 'STROKE'
  if (!(VARIABLE_SCOPES as readonly string[]).includes(scope)) {
    throw new Error(`in set_scopes: OpenPencil does not support the ${scope as string} scope`)
  }
  return scope
}

/** Figma refuses empty names and names with `.`, `{` or `}`, which its references reserve. */
const RESERVED_NAME_CHARACTERS = /[.{}]/

/** Figma's checks for a variable name: not empty, not reserved, not taken in the collection. */
export function assertVariableName(
  graph: SceneGraph,
  method: string,
  name: string,
  collectionId: string,
  self?: string
): void {
  if (name === '') throw new Error(`in ${method}: name cannot be empty`)
  if (RESERVED_NAME_CHARACTERS.test(name)) throw new Error(`in ${method}: invalid variable name`)
  const taken = graph.variableCollections
    .get(collectionId)
    ?.variableIds.some((id) => id !== self && graph.variables.get(id)?.name === name)
  if (taken) throw new Error(`in ${method}: duplicate variable name`)
}

/** Stores one mode's value and shows it on the layers that use the variable. */
export function writeVariableValue(
  graph: SceneGraph,
  variable: Variable,
  modeId: string,
  value: VariableValue
): void {
  variable.valuesByMode[modeId] = structuredClone(value)
  updateTokenExpression(variable, modeId, value)
  reconcileVariableLayouts(graph, { variables: [variable.id] })
}

/** A variable as Figma's plugin API hands it out, reading and writing the document's. */
export class FigmaVariable {
  readonly id: string
  readonly remote = false
  readonly #graph: SceneGraph

  constructor(graph: SceneGraph, id: string) {
    this.#graph = graph
    this.id = id
  }

  get #variable(): Variable {
    const variable = this.#graph.variables.get(this.id)
    if (!variable) throw new Error(`Variable ${this.id} has been removed`)
    return variable
  }

  get name(): string {
    return this.#variable.name
  }

  set name(name: string) {
    const variable = this.#variable
    assertVariableName(this.#graph, 'set_name', name, variable.collectionId, variable.id)
    variable.name = name
  }

  get description(): string {
    return this.#variable.description
  }

  set description(description: string) {
    this.#variable.description = description
  }

  get hiddenFromPublishing(): boolean {
    return this.#variable.hiddenFromPublishing
  }

  set hiddenFromPublishing(hidden: boolean) {
    this.#variable.hiddenFromPublishing = hidden
  }

  get variableCollectionId(): string {
    return this.#variable.collectionId
  }

  get key(): string {
    return this.#variable.key ?? ''
  }

  get resolvedType(): VariableType {
    return this.#variable.type
  }

  get valuesByMode(): Record<string, FigmaVariableValue> {
    const variable = this.#variable
    return Object.fromEntries(
      Object.keys(variable.valuesByMode).map((modeId) => [
        modeId,
        figmaVariableValue(this.#graph, variable, modeId)
      ])
    )
  }

  get scopes(): FigmaVariableScope[] {
    return (this.#variable.scopes ?? ['ALL_SCOPES']).flatMap(figmaScope)
  }

  /** Scopes the plugin API cannot name stay, as the script never saw them. */
  set scopes(scopes: FigmaVariableScope[]) {
    const variable = this.#variable
    if (scopes.includes('ALL_SCOPES')) {
      delete variable.scopes
      return
    }
    const unnamed = (variable.scopes ?? []).filter((scope) => figmaScope(scope).length === 0)
    variable.scopes = uniq([...scopes.map(documentScope), ...unnamed])
  }

  get codeSyntax(): Partial<Record<CodeSyntaxPlatform, string>> {
    return { ...this.#variable.codeSyntax }
  }

  setVariableCodeSyntax(platform: CodeSyntaxPlatform, value: string): void {
    const variable = this.#variable
    variable.codeSyntax = { ...variable.codeSyntax, [platform]: value }
  }

  removeVariableCodeSyntax(platform: CodeSyntaxPlatform): void {
    const variable = this.#variable
    const { [platform]: _removed, ...rest } = variable.codeSyntax ?? {}
    variable.codeSyntax = rest
  }

  /** Sets one mode's value; a reference that would make the variable read itself is ignored. */
  setValueForMode(modeId: string, newValue: FigmaVariableValue): void {
    const variable = this.#variable
    const value = storedVariableValue(this.#graph, variable, modeId, newValue)
    if (value !== null) writeVariableValue(this.#graph, variable, modeId, value)
  }

  /** The value the variable gives `consumer`, in the modes that layer resolves. */
  resolveForConsumer(consumer: { readonly id: string }): {
    value: FigmaVariableValue
    resolvedType: VariableType
  } {
    const variable = this.#variable
    const value = this.#graph.resolveVariableForNode(consumer.id, variable.id)
    if (value !== undefined) {
      return {
        value: typeof value === 'object' ? { ...value } : value,
        resolvedType: variable.type
      }
    }
    const modeId = this.#graph.getNodeVariableModeId(consumer.id, variable.collectionId)
    return { value: figmaVariableValue(this.#graph, variable, modeId), resolvedType: variable.type }
  }

  remove(): void {
    this.#graph.removeVariable(this.#variable.id)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      resolvedType: this.resolvedType,
      variableCollectionId: this.variableCollectionId,
      valuesByMode: this.valuesByMode
    }
  }
}

/** A variable collection as Figma's plugin API hands it out. */
export class FigmaVariableCollection {
  readonly id: string
  readonly remote = false
  readonly isExtension = false
  readonly #graph: SceneGraph

  constructor(graph: SceneGraph, id: string) {
    this.#graph = graph
    this.id = id
  }

  get #collection(): VariableCollection {
    const collection = this.#graph.variableCollections.get(this.id)
    if (!collection) throw new Error(`Variable collection ${this.id} has been removed`)
    return collection
  }

  get name(): string {
    return this.#collection.name
  }

  set name(name: string) {
    this.#collection.name = name
  }

  get hiddenFromPublishing(): boolean {
    return false
  }

  get modes(): Array<{ modeId: string; name: string }> {
    return this.#collection.modes.map(({ modeId, name }) => ({ modeId, name }))
  }

  get defaultModeId(): string {
    return this.#collection.defaultModeId
  }

  get variableIds(): string[] {
    return [...this.#collection.variableIds]
  }

  get key(): string {
    return this.#collection.key ?? ''
  }

  /** Adds a mode that starts with every variable's default-mode value, as Figma does. */
  addMode(name: string): string {
    const modeId = this.#graph.createMode(this.#collection.id, name)
    if (modeId === undefined) throw new Error('in addMode: Could not find variable collection')
    return modeId
  }

  renameMode(modeId: string, newName: string): void {
    const collection = this.#collection
    if (!collection.modes.some((mode) => mode.modeId === modeId))
      throw new Error('in renameMode: Could not find mode')
    this.#graph.renameMode(collection.id, modeId, newName)
  }

  /** Removes a mode; removing the default makes the next mode the default, as in Figma. */
  removeMode(modeId: string): void {
    const collection = this.#collection
    if (!collection.modes.some((mode) => mode.modeId === modeId))
      throw new Error('in removeMode: Could not find mode')
    this.#graph.removeMode(collection.id, modeId)
    reconcileVariableLayouts(this.#graph, { variables: collection.variableIds })
  }

  remove(): void {
    this.#graph.removeCollection(this.#collection.id)
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      modes: this.modes,
      defaultModeId: this.defaultModeId,
      variableIds: this.variableIds
    }
  }
}
