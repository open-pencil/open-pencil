import type { SceneGraph, VariableType } from '@open-pencil/scene-graph'

import { FIGMA_DEFAULT_VALUES, variableAlias, type FigmaVariableAlias } from './values'
import { FigmaVariable, FigmaVariableCollection, assertVariableName } from './variable'

export { FigmaVariable, FigmaVariableCollection, writeVariableValue } from './variable'
export type { FigmaComposedColor, FigmaVariableAlias, FigmaVariableValue } from './values'
export {
  figmaBoundVariables,
  paintBindings,
  setLayerBinding,
  setPaintBindings,
  type FigmaBindableField
} from './bindings'

/** Figma's variable types, including the motion types OpenPencil does not model. */
const FIGMA_TYPES = ['BOOLEAN', 'COLOR', 'FLOAT', 'STRING', 'EASING', 'TIMING'] as const
export type FigmaVariableResolvedType = (typeof FIGMA_TYPES)[number]

function assertType(method: string, type: unknown): FigmaVariableResolvedType {
  if (!(FIGMA_TYPES as readonly unknown[]).includes(type)) {
    throw new Error(
      `in ${method}: Property "resolvedType" failed validation: Invalid option: expected one of ` +
        FIGMA_TYPES.map((name) => `"${name}"`).join('|')
    )
  }
  return type as FigmaVariableResolvedType
}

function isModelledType(type: FigmaVariableResolvedType): type is VariableType {
  return Object.hasOwn(FIGMA_DEFAULT_VALUES, type)
}

/** A solid paint as `setBoundVariableForPaint` takes and returns it. */
type FigmaSolidPaint = {
  readonly type: string
  readonly boundVariables?: { color?: FigmaVariableAlias }
}

/** `figma.variables`: the document's variables and collections, as Figma's plugin API has them. */
export class FigmaVariablesAPI {
  readonly #graph: SceneGraph

  constructor(graph: SceneGraph) {
    this.#graph = graph
  }

  getVariableById(id: string): FigmaVariable | null {
    return this.#graph.variables.has(id) ? new FigmaVariable(this.#graph, id) : null
  }

  async getVariableByIdAsync(id: string): Promise<FigmaVariable | null> {
    return this.getVariableById(id)
  }

  getVariableCollectionById(id: string): FigmaVariableCollection | null {
    return this.#graph.variableCollections.has(id)
      ? new FigmaVariableCollection(this.#graph, id)
      : null
  }

  async getVariableCollectionByIdAsync(id: string): Promise<FigmaVariableCollection | null> {
    return this.getVariableCollectionById(id)
  }

  getLocalVariables(type?: FigmaVariableResolvedType): FigmaVariable[] {
    const wanted = type === undefined ? undefined : assertType('getLocalVariables', type)
    return [...this.#graph.variables.values()]
      .filter((variable) => wanted === undefined || variable.type === wanted)
      .map((variable) => new FigmaVariable(this.#graph, variable.id))
  }

  async getLocalVariablesAsync(type?: FigmaVariableResolvedType): Promise<FigmaVariable[]> {
    return this.getLocalVariables(type)
  }

  getLocalVariableCollections(): FigmaVariableCollection[] {
    return [...this.#graph.variableCollections.keys()].map(
      (id) => new FigmaVariableCollection(this.#graph, id)
    )
  }

  async getLocalVariableCollectionsAsync(): Promise<FigmaVariableCollection[]> {
    return this.getLocalVariableCollections()
  }

  /** A variable in `collection` whose every mode starts at Figma's default for its type. */
  createVariable(
    name: string,
    collection: { readonly id: string } | string,
    resolvedType: FigmaVariableResolvedType
  ): FigmaVariable {
    const type = assertType('createVariable', resolvedType)
    if (!isModelledType(type))
      throw new Error(`in createVariable: OpenPencil does not support ${type} variables`)
    const collectionId = typeof collection === 'string' ? collection : collection.id
    if (!this.#graph.variableCollections.has(collectionId)) {
      throw new Error('in createVariable: Could not find variable collection')
    }
    assertVariableName(this.#graph, 'createVariable', name, collectionId)
    const variable = this.#graph.createVariable(
      name,
      type,
      collectionId,
      structuredClone(FIGMA_DEFAULT_VALUES[type])
    )
    return new FigmaVariable(this.#graph, variable.id)
  }

  createVariableCollection(name: string): FigmaVariableCollection {
    return new FigmaVariableCollection(this.#graph, this.#graph.createCollection(name).id)
  }

  createVariableAlias(variable: { readonly id: string }): FigmaVariableAlias {
    return variableAlias(variable.id)
  }

  async createVariableAliasByIdAsync(variableId: string): Promise<FigmaVariableAlias> {
    if (!this.#graph.variables.has(variableId)) {
      throw new Error('in createVariableAliasByIdAsync: Variable not found')
    }
    return variableAlias(variableId)
  }

  /**
   * A copy of `paint` whose colour is bound to `variable`, or unbound for `null`; it binds when the
   * paint is set on a layer. Colour is the one paint field Figma binds.
   */
  setBoundVariableForPaint<T extends FigmaSolidPaint>(
    paint: T,
    _field: 'color',
    variable: { readonly id: string } | null
  ): T & { boundVariables: { color?: FigmaVariableAlias } } {
    const { color: _previous, ...others } = paint.boundVariables ?? {}
    if (variable === null) return { ...structuredClone(paint), boundVariables: others }
    if (this.#graph.variables.get(variable.id)?.type !== 'COLOR') {
      throw new Error('in setBoundVariableForPaint: can only bind color variables to color')
    }
    return {
      ...structuredClone(paint),
      boundVariables: { ...others, color: variableAlias(variable.id) }
    }
  }
}
