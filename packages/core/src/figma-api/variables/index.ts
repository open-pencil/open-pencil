import type {
  BlurEffectNormal,
  DropShadowEffect,
  Effect as PluginEffect,
  InnerShadowEffect,
  VariableBindableEffectField
} from '@figma/plugin-typings/plugin-api-standalone'

import type { SceneGraph, VariableType } from '@open-pencil/scene-graph'
import {
  EFFECT_BINDING_PROPERTIES,
  effectBindableProperties,
  effectBindingVariableType,
  type EffectBindingProperty
} from '@open-pencil/scene-graph/variables'

import type { FigmaEffect, FigmaEffectBindings } from '#core/figma-api/effects'

import { FIGMA_DEFAULT_VALUES, variableAlias, type FigmaVariableAlias } from './values'
import { FigmaVariable, FigmaVariableCollection, assertVariableName } from './variable'

export { FigmaVariable, FigmaVariableCollection, writeVariableValue } from './variable'
export type { FigmaComposedColor, FigmaVariableAlias, FigmaVariableValue } from './values'
export {
  figmaBoundVariables,
  paintBindings,
  setLayerBinding,
  effectBindings,
  setEffectBindings,
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

  /**
   * A copy of `effect` with one property bound to `variable`; it binds when the effect is set on a
   * layer. As in Figma, the copy's values are not resolved yet, a shadow's spread reads 0, and
   * `null` unbinds every property of the effect, not only `field`.
   */
  setBoundVariableForEffect(
    effect: PluginEffect,
    field: VariableBindableEffectField,
    variable: { readonly id: string } | null
  ): FigmaEffect {
    const modelled = modelledEffect(effect)
    const property = assertEffectField(modelled, field)
    if (variable === null) return effectCopy(modelled, {})
    if (typeof variable !== 'object') {
      throw new TypeError(`in setBoundVariableForEffect: Expected node, got ${typeof variable}`)
    }
    const type = effectBindingVariableType(property)
    if (this.#graph.variables.get(variable.id)?.type !== type) {
      throw new Error(
        `in setBoundVariableForEffect: can only bind ${type.toLowerCase()} variables to ${property}`
      )
    }
    return effectCopy(modelled, {
      ...modelled.boundVariables,
      [property]: variableAlias(variable.id)
    })
  }
}

/** The shadows and plain blurs OpenPencil models; other effects are refused, as `effects` does. */
type ModelledEffect = DropShadowEffect | InnerShadowEffect | BlurEffectNormal

function modelledEffect(effect: PluginEffect): ModelledEffect {
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') return effect
  if (effect.type === 'LAYER_BLUR' || effect.type === 'BACKGROUND_BLUR') {
    if (effect.blurType !== 'PROGRESSIVE') return effect
    throw new Error('in setBoundVariableForEffect: Progressive blur is not supported')
  }
  throw new Error(`in setBoundVariableForEffect: ${effect.type} effects are not supported`)
}

function isShadow(effect: ModelledEffect): effect is DropShadowEffect | InnerShadowEffect {
  return effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW'
}

/** `effect` as `setBoundVariableForEffect` returns it, fields in Figma's order, spread at 0. */
function effectCopy(effect: ModelledEffect, boundVariables: FigmaEffectBindings): FigmaEffect {
  const { visible, radius } = effect
  if (!isShadow(effect)) {
    return { type: effect.type, visible, radius, boundVariables, blurType: 'NORMAL' }
  }
  const shadow = {
    visible,
    radius,
    boundVariables,
    color: { ...effect.color },
    offset: { ...effect.offset },
    spread: 0,
    blendMode: effect.blendMode
  }
  if (effect.type === 'INNER_SHADOW') return { type: effect.type, ...shadow }
  return effect.showShadowBehindNode === undefined
    ? { type: effect.type, ...shadow }
    : { type: effect.type, ...shadow, showShadowBehindNode: effect.showShadowBehindNode }
}

/** Figma's check of the property `setBoundVariableForEffect` binds, which a blur limits to radius. */
function assertEffectField(effect: ModelledEffect, field: unknown): EffectBindingProperty {
  const properties = effectBindableProperties(effect.type)
  const found = properties.find((property) => property === field)
  if (found) return found
  const expected =
    properties.length === 1
      ? `Invalid input: expected "${properties[0]}"`
      : `Invalid option: expected one of ${EFFECT_BINDING_PROPERTIES.map((name) => `"${name}"`).join('|')}`
  throw new Error(`in setBoundVariableForEffect: Property "field" failed validation: ${expected}`)
}
