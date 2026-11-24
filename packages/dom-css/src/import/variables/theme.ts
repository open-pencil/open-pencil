import type { DesignDocument } from '#dom-css/types'

import type { SceneGraph, Variable, VariableValue } from '@open-pencil/scene-graph'
import { colorToHex } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { expressionLabel, referencedProperty } from './expression'
import type { CustomPropertyValue } from './probe'

/** One mode of an imported theme: the page styled in it, and its custom properties' values. */
export interface ThemeMode {
  name: string
  styled: DesignDocument
  values: ReadonlyMap<string, CustomPropertyValue>
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
  readonly #byProperty = new Map<string, Variable>()
  readonly #combined = new Map<string, Variable>()

  constructor(graph: SceneGraph, theme: HTMLTheme) {
    this.#graph = graph
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
    const initial = modes[0].values
    for (const [property, value] of initial) {
      const variable = this.#graph.createVariable(
        property.replace(/^--/, ''),
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
          const own = mode.values.get(property)
          const value = own?.type === variable.type ? own : initial.get(property)
          const alias = this.named(referencedProperty(mode.styled.customProperties?.[property]))
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

  #unusedName(label: string): string {
    const taken = new Set(
      [...this.#byProperty.values(), ...this.#combined.values()].map(({ name }) => name)
    )
    let name = label
    for (let index = 2; taken.has(name); index++) name = `${label} ${index}`
    return name
  }

  /** A color's variable: its property's, or one that holds what it is in each mode. */
  forColors(colors: readonly ModeColor[]): Variable {
    const direct = colors.map(({ expression }) => this.named(referencedProperty(expression ?? '')))
    const [first] = direct
    if (first && direct.every((variable) => variable?.id === first.id)) return first
    const labels = colors.map(({ expression, color }) =>
      expression ? expressionLabel(expression) : literalLabel(color)
    )
    const label = labels.every((each) => each === labels[0]) ? labels[0] : labels.join(' | ')
    // One expression can give different colors, as one holding `currentcolor` does.
    const key = JSON.stringify([label, colors])
    const known = this.#combined.get(key)
    if (known) return known
    const variable = this.#graph.createVariable(
      this.#unusedName(label),
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
