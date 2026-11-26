import type { DesignCustomProperty } from '#dom-css/types'
import { isEqual } from 'es-toolkit/predicate'

import type { SceneGraph, Variable, VariableValue } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { anyCSSColor } from '../css-values'
import { expressionLabel, propertyName, referencedProperty } from './expression'

/** One mode of an imported theme: its name, and its root's custom properties. */
export interface ThemeMode {
  name: string
  customProperties?: Record<string, DesignCustomProperty>
}

/** What a custom property holds as a variable: a color, or a number with how CSS reads it. */
type CustomPropertyValue =
  | { type: 'COLOR'; color: Color }
  | { type: 'FLOAT'; number: number; unit: 'length' | 'number' }

function valueOf(property: DesignCustomProperty | undefined): CustomPropertyValue | null {
  const color = anyCSSColor(property?.color)
  if (color) return { type: 'COLOR', color }
  if (property?.length !== undefined)
    return { type: 'FLOAT', number: property.length, unit: 'length' }
  if (property?.number !== undefined)
    return { type: 'FLOAT', number: property.number, unit: 'number' }
  return null
}

function valueIn(mode: ThemeMode, property: string): CustomPropertyValue | null {
  return valueOf(mode.customProperties?.[property])
}

/** A page's custom properties to import as variables, one mode per way the page was styled. */
export interface HTMLTheme {
  /** The collection the variables go in. */
  collection: string
  /** The first mode is the one the layers are built from. */
  modes: readonly ThemeMode[]
}

/** A color in one mode: what the page wrote, when it names a custom property, and what it gave. */
export interface ModeColor {
  expression: string | null
  color: Color
}

/** One label for a color in every mode, `a | b` where they differ; none where one has none. */
function joinedLabel(labels: readonly (string | null)[]): string | null {
  if (labels.some((label) => label === null)) return null
  return labels.every((label) => label === labels[0]) ? labels[0] : labels.join(' | ')
}

/** The name of a color no property names. */
const UNNAMED = 'Color'

function literalLabel(color: Color): string {
  return color.a === 0 ? 'transparent' : colorToHex(color)
}

function addedMode(graph: SceneGraph, collectionId: string, name: string): string {
  const modeId = graph.createMode(collectionId, name)
  if (!modeId) throw new Error(`Could not add the mode ${name}`)
  return modeId
}

/**
 * The variables imported from a page's custom properties, one per property the root declares, and
 * the ones made for colors no single property gives, such as a translucent one or one that names a
 * different property in each mode.
 */
export class ThemeVariables {
  readonly #graph: SceneGraph
  readonly #collectionId: string
  readonly #modeIds: string[]
  readonly #modes: readonly ThemeMode[]
  readonly #byProperty = new Map<string, Variable>()
  readonly #combined = new Map<string, Variable>()

  constructor(graph: SceneGraph, theme: HTMLTheme) {
    this.#graph = graph
    this.#modes = theme.modes
    const collection = graph.createCollection(theme.collection)
    this.#collectionId = collection.id
    const [first, ...rest] = theme.modes
    graph.renameMode(collection.id, collection.defaultModeId, first.name)
    this.#modeIds = [
      collection.defaultModeId,
      ...rest.map((mode) => addedMode(graph, collection.id, mode.name))
    ]
    this.#createProperties(theme)
  }

  #createProperties({ modes }: HTMLTheme): void {
    for (const property of Object.keys(modes[0].customProperties ?? {})) {
      const value = valueIn(modes[0], property)
      if (!value) continue
      const variable = this.#graph.createVariable(
        propertyName(property),
        value.type,
        this.#collectionId
      )
      variable.codeSyntax = { WEB: `var(${property})` }
      this.#byProperty.set(property, variable)
    }
    for (const [property, variable] of this.#byProperty) {
      this.#setValues(
        variable,
        modes.map((mode) => {
          // A property a mode sets to something else entirely keeps the first mode's value.
          const own = valueIn(mode, property)
          const value = own?.type === variable.type ? own : valueIn(modes[0], property)
          const declared = mode.customProperties?.[property]?.declared
          const alias = this.named(referencedProperty(declared))
          if (alias && alias.type === variable.type && alias.id !== variable.id)
            return { aliasId: alias.id }
          return value?.type === 'COLOR' ? value.color : (value?.number ?? 0)
        })
      )
    }
  }

  #setValues(variable: Variable, values: VariableValue[]): void {
    variable.valuesByMode = Object.fromEntries(
      this.#modeIds.map((modeId, index) => [modeId, values[index]])
    )
  }

  named(property: string | null | undefined): Variable | undefined {
    return property ? this.#byProperty.get(property) : undefined
  }

  /**
   * A number variable's value in each mode where it holds `unit`, as a length a layer's pixels
   * can take, or a plain number such as an opacity.
   */
  numbers(property: string, unit: 'length' | 'number'): (number | undefined)[] {
    return this.#modes.map((mode) => {
      const own = valueIn(mode, property)
      return own?.type === 'FLOAT' && own.unit === unit ? own.number : undefined
    })
  }

  #unusedName(label: string, numbered = false): string {
    const taken = new Set(
      [...this.#byProperty.values(), ...this.#combined.values()].map(({ name }) => name)
    )
    // A color no property names is numbered from one, as `Color 1`; a named one from its second.
    let index = numbered ? 1 : 2
    let name = numbered ? `${label} ${index++}` : label
    while (taken.has(name)) name = `${label} ${index++}`
    return name
  }

  /** Whether a variable is a color in a mode, which one that is no color there is not. */
  #holds(variable: Variable, mode: number, color: Color): boolean {
    return isEqual(this.#graph.resolveVariable(variable.id, this.#modeIds[mode]), color)
  }

  /** A color's variable: its property's, or one that holds what it is in each mode. */
  forColors(colors: readonly ModeColor[]): Variable {
    const direct = colors.map(({ expression, color }, index) => {
      const variable = this.named(referencedProperty(expression ?? ''))
      return variable && this.#holds(variable, index, color) ? variable : undefined
    })
    const [first] = direct
    if (first && direct.every((variable) => variable?.id === first.id)) return first
    const labels = colors.map(({ expression, color }) =>
      expression ? expressionLabel(expression) : literalLabel(color)
    )
    const named = joinedLabel(labels)
    const label = named ?? UNNAMED
    // One expression can give different colors, as one holding `currentcolor` does.
    const key = JSON.stringify([label, colors])
    const known = this.#combined.get(key)
    if (known) return known
    const variable = this.#graph.createVariable(
      this.#unusedName(label, named === null),
      'COLOR',
      this.#collectionId
    )
    this.#combined.set(key, variable)
    this.#setValues(
      variable,
      colors.map(({ color }, index) => {
        const alias = direct[index]
        return alias ? { aliasId: alias.id } : color
      })
    )
    return variable
  }
}
