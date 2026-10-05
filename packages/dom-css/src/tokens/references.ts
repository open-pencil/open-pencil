import {
  type Color,
  type SceneGraph,
  type SceneNode,
  type Variable
} from '@open-pencil/scene-graph'

import { collectionVariables, variableCSSNames, variableNamespace } from './names'
import { modeAttribute } from './stylesheet'
import { variableUnit } from './values'

/** The mode CSS applies for each collection, by collection id. */
export type CSSModes = ReadonlyMap<string, string>

/** Bound fields drawn as a length; any other numeric binding is unitless or not exported. */
const LENGTH_FIELDS = new Set([
  'width',
  'height',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'strokeWeight',
  'borderTopWeight',
  'borderBottomWeight',
  'borderLeftWeight',
  'borderRightWeight',
  'fontSize',
  'letterSpacing',
  'lineHeight',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'counterAxisSpacing',
  'gridRowGap',
  'gridColumnGap'
])

const LENGTH_UNITS = new Set(['px', 'rem'])

/** Color channels are stored as floats; a bound paint copies them, so this only absorbs rounding. */
const CHANNEL_TOLERANCE = 1 / 512

const CHANNELS = ['r', 'g', 'b', 'a'] as const

function sameColor(a: Color, b: Color): boolean {
  return CHANNELS.every((channel) => Math.abs(a[channel] - b[channel]) <= CHANNEL_TOLERANCE)
}

function isColor(value: unknown): value is Color {
  return typeof value === 'object' && value !== null && 'r' in value && 'a' in value
}

/** Where an alias chain ends in the modes the canvas draws: a value, or a CSS expression. */
type TokenChain = {
  ids: string[]
  value: Variable['valuesByMode'][string] | undefined
  end: Variable
  expression: boolean
}

/** The paint a `fills/0/color` or `strokes/1/color` binding names. */
function boundPaint(node: SceneNode, field: string) {
  const [list, index] = field.split('/')
  if (list === 'fills') return node.fills[Number(index)]
  if (list === 'strokes') return node.strokes[Number(index)]
  return undefined
}

/**
 * Variable references for design-to-code. A bound field becomes `var(--name)` only when the
 * stylesheet resolves it to what the canvas draws: the element sits in the same modes, and the
 * token's CSS value is a length for a length, a bare number for opacity, or the paint's color.
 * Anything else keeps its literal value.
 */
export class DesignTokens {
  readonly names: ReadonlyMap<string, string>
  /** Tokens the output references, with every variable their aliases reach. */
  readonly used = new Set<string>()
  readonly #graph: SceneGraph

  constructor(graph: SceneGraph) {
    this.#graph = graph
    this.names = variableCSSNames(collectionVariables(graph))
  }

  /** The modes CSS applies outside the exported nodes: every collection's default. */
  defaultModes(): CSSModes {
    return new Map(
      [...this.#graph.variableCollections.values()].map((collection) => [
        collection.id,
        collection.defaultModeId
      ])
    )
  }

  /**
   * Attributes that put an element in the modes the canvas draws it in, and the modes CSS then
   * applies to it. An exported root takes the editor's active modes; below it, a node changes
   * modes only where it sets one. Only a mode without its own condition can be set this way.
   */
  enter(
    node: SceneNode,
    inherited: CSSModes,
    root: boolean
  ): { attrs: Record<string, string>; modes: CSSModes } {
    const attrs: Record<string, string> = {}
    const modes = new Map(inherited)
    for (const collection of this.#graph.variableCollections.values()) {
      if (!root && !node.variableModes[collection.id]) continue
      const modeId = this.#graph.getNodeVariableModeId(node.id, collection.id)
      const mode = collection.modes.find((candidate) => candidate.modeId === modeId)
      if (!mode || modeId === inherited.get(collection.id)) continue
      if (modeId === collection.defaultModeId || mode.condition) continue
      const { name, value } = modeAttribute(collection, mode)
      attrs[name] = value
      modes.set(collection.id, modeId)
    }
    return { attrs, modes }
  }

  /** `var(--name)` for a bound field, or `undefined` where the literal value must stay. */
  reference(node: SceneNode, field: string, modes: CSSModes): string | undefined {
    const variableId = node.boundVariables[field]
    const variable = variableId ? this.#graph.variables.get(variableId) : undefined
    const name = variable && this.names.get(variable.id)
    if (!variable || !name) return undefined
    const chain = this.#chain(node, variable, modes)
    if (!chain || !this.#drawsResolved(node, field, chain)) return undefined
    for (const id of chain.ids) this.used.add(id)
    return `var(--${name})`
  }

  /**
   * Follow aliases in the modes the canvas draws the node in, stopping at a value or at a CSS
   * expression, which is what the stylesheet writes for that mode. Fails where CSS would resolve
   * any link in another mode.
   */
  #chain(node: SceneNode, start: Variable, modes: CSSModes): TokenChain | undefined {
    const ids: string[] = []
    let variable: Variable | undefined = start
    while (variable && !ids.includes(variable.id)) {
      ids.push(variable.id)
      const modeId = this.#graph.getNodeVariableModeId(node.id, variable.collectionId)
      const collection = this.#graph.variableCollections.get(variable.collectionId)
      const cssModeId = modes.get(variable.collectionId) ?? collection?.defaultModeId
      if (modeId !== cssModeId) return undefined
      const value =
        variable.valuesByMode[modeId] ??
        (collection ? variable.valuesByMode[collection.defaultModeId] : undefined)
      if (variable.expressions?.[modeId]) return { ids, value, end: variable, expression: true }
      if (typeof value === 'object' && 'aliasId' in value) {
        variable = this.#graph.variables.get(value.aliasId)
        continue
      }
      return { ids, value, end: variable, expression: false }
    }
    return undefined
  }

  #drawsResolved(node: SceneNode, field: string, { value, end, expression }: TokenChain): boolean {
    if (field.endsWith('/color')) {
      const paint = boundPaint(node, field)
      if (!paint?.visible || paint.type !== 'SOLID' || !isColor(value)) return false
      return sameColor({ ...paint.color, a: paint.opacity }, value)
    }
    const drawn: unknown = Reflect.get(node, field)
    if (typeof drawn !== 'number' || typeof value !== 'number') return false
    if (Math.fround(drawn) !== Math.fround(value)) return false
    // An expression is the author's CSS for the value, whatever unit the token stores.
    if (field === 'opacity') return expression || variableUnit(end) === 'none'
    return LENGTH_FIELDS.has(field) && (expression || LENGTH_UNITS.has(variableUnit(end)))
  }

  /**
   * The variables a stylesheet for this output declares: the referenced ones and every variable
   * their aliases reach in any mode, since each mode's scope declares its own alias targets.
   */
  stylesheetVariables(): Set<string> {
    const ids = new Set<string>()
    const pending = [...this.used]
    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
      if (ids.has(id)) continue
      ids.add(id)
      for (const value of Object.values(this.#graph.variables.get(id)?.valuesByMode ?? {}))
        if (typeof value === 'object' && 'aliasId' in value) pending.push(value.aliasId)
    }
    return ids
  }

  /** Custom properties the Tailwind stylesheet declares in `@theme`, which name utilities. */
  themeVariables(): string[] {
    return [...this.names].flatMap(([id, name]) => {
      const variable = this.#graph.variables.get(id)
      return variable && variableNamespace(variable) !== undefined ? [`--${name}`] : []
    })
  }
}
