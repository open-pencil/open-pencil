import { ownerVariants } from '#dom-css/behaviours/states/model'
import type { StateElement } from '#dom-css/behaviours/states/types'
import { camelCase } from 'es-toolkit/string'

import {
  behaviourProperties,
  findLayerByPath,
  type ComponentPropertyReferenceField,
  type SceneGraph,
  type SceneNode
} from '@open-pencil/scene-graph'

import { claimName, identifierName } from '../storybook/names'

/** A text property the component takes as a string prop and draws in the layers bound to it. */
export interface TextProp {
  /** The prop's identifier. */
  name: string
  /** The text property's id, which instances assign values by. */
  id: string
  /** The text property's name. */
  property: string
  default: string
}

/** A boolean property the component takes as a prop, showing the layers bound to it while on. */
export interface BooleanProp {
  /** The prop's identifier. */
  name: string
  /** The boolean property's id, which instances assign values by. */
  id: string
  /** The boolean property's name. */
  property: string
  default: boolean
}

/**
 * A slot property the component takes as content in place of the design's, which it shows
 * when none is given.
 */
export interface SlotProp {
  /** The prop's identifier, and the slot's name in Vue. */
  name: string
  /** The slot property's id. */
  id: string
  /** The slot property's name. */
  property: string
}

/**
 * The layers bound to a property through `field`, each with the prop it draws. A layer is
 * bound when it is in any variant, found by the path every variant shares.
 */
function boundLayers(
  graph: SceneGraph,
  set: SceneNode,
  elements: readonly StateElement[],
  field: ComponentPropertyReferenceField,
  props: ReadonlyMap<string, string>
): Map<StateElement, string> {
  const variants = ownerVariants(graph, set)
  const bound = new Map<StateElement, string>()
  for (const element of elements) {
    const path = element.key.split('\0')[0] ?? ''
    for (const variant of variants) {
      const reference = findLayerByPath(graph, variant.id, path)?.componentPropertyReferences.find(
        (item) => item.field === field
      )
      const prop = reference && props.get(reference.propertyId)
      if (prop) {
        bound.set(element, prop)
        break
      }
    }
  }
  return bound
}

const propName = (property: string, taken: Set<string>, fallback: string) =>
  claimName(camelCase(identifierName(property, fallback)), taken)

/** The set's boolean properties as props, and the layers each shows while it is on. */
export function booleanProps(
  graph: SceneGraph,
  set: SceneNode,
  elements: readonly StateElement[],
  taken: Set<string>
): { booleans: BooleanProp[]; shownBy: Map<StateElement, string> } {
  const booleans = behaviourProperties(graph, set)
    .filter((definition) => definition.type === 'BOOLEAN')
    .map((definition) => ({
      name: propName(definition.name, taken, 'Shown'),
      id: definition.id,
      property: definition.name,
      default: definition.defaultValue === 'true'
    }))
  const byId = new Map(booleans.map((prop) => [prop.id, prop.name]))
  return { booleans, shownBy: boundLayers(graph, set, elements, 'VISIBLE', byId) }
}

/**
 * The set's slot properties as props, and the frame each fills, except frames a behaviour
 * draws its parts in, such as a switch's thumb, which stay its parts.
 */
export function slotProps(
  graph: SceneGraph,
  set: SceneNode,
  elements: readonly StateElement[],
  taken: Set<string>,
  parts: ReadonlyMap<StateElement, string>
): { slots: SlotProp[]; slotOf: Map<StateElement, string> } {
  const definitions = behaviourProperties(graph, set).filter(
    (definition) => definition.type === 'SLOT'
  )
  const frames = elements.filter((element) => !parts.has(element))
  const slots = definitions.map((definition) => ({
    name: propName(definition.name, taken, 'Content'),
    id: definition.id,
    property: definition.name
  }))
  const byId = new Map(slots.map((prop) => [prop.id, prop.name]))
  const slotOf = boundLayers(graph, set, frames, 'SLOT_CONTENT', byId)
  // A slot no layer draws has nowhere to show its content, so it is no prop.
  const drawn = new Set(slotOf.values())
  return { slots: slots.filter((slot) => drawn.has(slot.name)), slotOf }
}

/**
 * The set's text properties as props, and the layers bound to each. A layer is bound when it
 * is in any variant, found by the path every variant shares.
 */
export function textProps(
  graph: SceneGraph,
  set: SceneNode,
  elements: readonly StateElement[],
  taken: Set<string>,
  /** A field's text property, which its input shows rather than a prop. */
  input: string | undefined
): { texts: TextProp[]; bound: Map<StateElement, string>; input: StateElement[] } {
  const definitions = behaviourProperties(graph, set).filter(
    (item) => item.type === 'TEXT' && item.id !== input
  )
  const texts = definitions.map((definition) => ({
    name: claimName(camelCase(identifierName(definition.name, 'Text')), taken),
    id: definition.id,
    property: definition.name,
    default: definition.defaultValue
  }))
  const byId = new Map(definitions.map((definition, i) => [definition.id, texts[i]]))
  const variants = ownerVariants(graph, set)
  const bound = new Map<StateElement, string>()
  const inputs: StateElement[] = []
  for (const element of elements) {
    // A key ends with the words a layer reads, which a text prop draws in every variant.
    const path = element.key.split('\0')[0] ?? ''
    for (const variant of variants) {
      const reference = findLayerByPath(graph, variant.id, path)?.componentPropertyReferences.find(
        (item) => item.field === 'TEXT'
      )
      if (reference && reference.propertyId === input) {
        inputs.push(element)
        break
      }
      const prop = reference && byId.get(reference.propertyId)
      if (prop) {
        bound.set(element, prop.name)
        break
      }
    }
  }
  return { texts, bound, input: inputs }
}
