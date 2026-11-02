import type {
  StyleConsumers,
  StyleType,
  TextStyle
} from '@figma/plugin-typings/plugin-api-standalone'
import * as v from 'valibot'

import type { SceneGraph, SceneNode, SharedStyleType } from '@open-pencil/scene-graph'

import { figmaFills } from '#core/figma-api/accessors/visual'
import { parseFigmaPaints, type FigmaPaint } from '#core/figma-api/paints'
import type { FigmaNodeProxy } from '#core/figma-api/proxy'
import { parseFigma } from '#core/figma-api/validation'
import { setPaintBindings } from '#core/figma-api/variables/bindings'

import { releaseUsers, restyleUsers, styleConsumers, type LayerUpdate } from './apply'

/** The kinds of style OpenPencil keeps: Figma's, apart from custom animations. */
export type FigmaStyleType = Exclude<StyleType, 'CUSTOM_ANIMATION'>

export const STYLE_TYPES: Record<FigmaStyleType, SharedStyleType> = {
  PAINT: 'FILL',
  TEXT: 'TEXT',
  EFFECT: 'EFFECT',
  GRID: 'GRID'
}

/** What a style needs from the API that made it. */
export interface StyleHost {
  readonly graph: SceneGraph
  wrapNode(id: string): FigmaNodeProxy
  /** Applies changes to a layer as the plugin API's setters do. */
  readonly updateLayer: LayerUpdate
  /** Forgets a removed style's handle. */
  forgetStyle(id: string): void
}

/** Figma's `StyleConsumers`, the layer read as a node proxy. */
export type FigmaStyleConsumer = Omit<StyleConsumers, 'node'> & { node: FigmaNodeProxy }

const KEY = /^S:([0-9a-f]{40}),/

// Internals keyed by symbols, so scripts reach only the members of Figma's styles.
const HOST = Symbol('host')
const NODE = Symbol('node')
const LAYER = Symbol('layer')
const RESTYLE = Symbol('restyle')

/**
 * Figma's `BaseStyle`: a shared style the document holds, read and written through the node that
 * keeps its values. A change to the style reaches every layer and text range that uses it.
 */
export abstract class FigmaBaseStyle {
  readonly id: string
  abstract readonly type: FigmaStyleType
  readonly remote = false
  readonly documentationLinks: readonly never[] = Object.freeze([])
  readonly boundVariables: Readonly<Record<string, never>> = Object.freeze({})
  readonly [HOST]: StyleHost

  constructor(host: StyleHost, id: string) {
    this[HOST] = host
    this.id = id
  }

  /** The node holding the style's values, or Figma's refusal once the style is gone. */
  [NODE](method: string): SceneNode {
    const type = STYLE_TYPES[this.type]
    for (const node of this[HOST].graph.getAllNodes())
      if (node.sharedStyleType === type && node.source.id === this.id) return node
    throw new Error(`in ${method}: The style with id "${this.id}" does not exist`)
  }

  /** The style's node as a layer, whose setters check and store its values. */
  [LAYER](method: string): FigmaNodeProxy {
    return this[HOST].wrapNode(this[NODE](method).id)
  }

  /** Brings what uses the style up to its values, after they changed. */
  [RESTYLE](): void {
    restyleUsers(this[HOST].graph, this[NODE]('restyle'), this[HOST].updateLayer)
  }

  get name(): string {
    return this[NODE]('get_name').name
  }

  set name(value: string) {
    const node = this[NODE]('set_name')
    const name = parseFigma(v.string(), value, 'set_name', 'name')
    this[HOST].graph.updateNode(node.id, { name })
  }

  get description(): string {
    return this[NODE]('get_description').symbolDescription
  }

  /** Figma ignores a description that is not a string, without an error. */
  set description(value: string) {
    const node = this[NODE]('set_description')
    if (typeof value === 'string')
      this[HOST].graph.updateNode(node.id, { symbolDescription: value })
  }

  /** The key a library publishes the style by: the hex part of a local style's ID. */
  get key(): string {
    this[NODE]('get_key')
    return KEY.exec(this.id)?.[1] ?? ''
  }

  /** @deprecated Figma's synchronous form of `getStyleConsumersAsync`. */
  get consumers(): FigmaStyleConsumer[] {
    return styleConsumers(this[HOST].graph, this[NODE]('get_consumers')).map(
      ({ node, fields }) => ({
        node: this[HOST].wrapNode(node.id),
        fields
      })
    )
  }

  /** The layers that use the style themselves; text ranges that use it are not listed. */
  getStyleConsumersAsync(): Promise<FigmaStyleConsumer[]> {
    return Promise.resolve(this.consumers)
  }

  /** Deletes the style; what used it keeps the values it gave, as in Figma. */
  remove(): void {
    const style = this[NODE]('remove')
    releaseUsers(this[HOST].graph, style, this[HOST].updateLayer)
    this[HOST].graph.deleteNode(style.id)
    this[HOST].forgetStyle(this.id)
  }
}

export class FigmaPaintStyle extends FigmaBaseStyle {
  readonly type = 'PAINT'

  get paints(): readonly FigmaPaint[] {
    const node = this[NODE]('get_paints')
    return Object.freeze(figmaFills(this[HOST].graph, node).map((paint) => Object.freeze(paint)))
  }

  set paints(value: readonly FigmaPaint[]) {
    const node = this[NODE]('set_paints')
    const fills = parseFigmaPaints(value, 'set_paints', 'paints')
    this[HOST].graph.updateNode(node.id, { fills })
    // A paint bound to a variable keeps following it, as the style's consumers then do.
    setPaintBindings(this[HOST].graph, node, 'fills', value)
    this[RESTYLE]()
  }
}

export class FigmaEffectStyle extends FigmaBaseStyle {
  readonly type = 'EFFECT'

  get effects(): FigmaNodeProxy['effects'] {
    return this[LAYER]('get_effects').effects
  }

  set effects(value: FigmaNodeProxy['effects']) {
    this[LAYER]('set_effects').effects = value
    this[RESTYLE]()
  }
}

export class FigmaGridStyle extends FigmaBaseStyle {
  readonly type = 'GRID'

  get layoutGrids(): FigmaNodeProxy['layoutGrids'] {
    return this[LAYER]('get_layoutGrids').layoutGrids
  }

  set layoutGrids(value: FigmaNodeProxy['layoutGrids']) {
    this[LAYER]('set_layoutGrids').layoutGrids = value
    this[RESTYLE]()
  }
}

/** The fields a text style keeps, read and written as a text's own (Figma desktop 126). */
export const TEXT_STYLE_PROPERTIES = [
  'fontName',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationOffset',
  'textDecorationThickness',
  'textDecorationColor',
  'textDecorationSkipInk',
  'leadingTrim',
  'paragraphSpacing',
  'paragraphIndent',
  'listSpacing',
  'hangingList'
] as const satisfies readonly (keyof FigmaNodeProxy)[]

type TextStyleProperty = (typeof TEXT_STYLE_PROPERTIES)[number]

export class FigmaTextStyle extends FigmaBaseStyle {
  readonly type = 'TEXT'
  declare fontName: TextStyle['fontName']
  declare fontSize: TextStyle['fontSize']
  declare lineHeight: TextStyle['lineHeight']
  declare letterSpacing: TextStyle['letterSpacing']
  declare textCase: TextStyle['textCase']
  declare textDecoration: TextStyle['textDecoration']
  declare textDecorationStyle: FigmaNodeProxy['textDecorationStyle']
  declare textDecorationOffset: FigmaNodeProxy['textDecorationOffset']
  declare textDecorationThickness: FigmaNodeProxy['textDecorationThickness']
  declare textDecorationColor: FigmaNodeProxy['textDecorationColor']
  declare textDecorationSkipInk: FigmaNodeProxy['textDecorationSkipInk']
  declare leadingTrim: TextStyle['leadingTrim']
  declare paragraphSpacing: TextStyle['paragraphSpacing']
  declare paragraphIndent: TextStyle['paragraphIndent']
  declare listSpacing: TextStyle['listSpacing']
  declare hangingList: TextStyle['hangingList']
}

// Each field is read from, and written to, the text that keeps the style, which checks it as a
// text's own setter does; a change restyles what uses the style.
for (const property of TEXT_STYLE_PROPERTIES satisfies readonly TextStyleProperty[]) {
  Object.defineProperty(FigmaTextStyle.prototype, property, {
    enumerable: true,
    get(this: FigmaTextStyle) {
      return this[LAYER](`get_${property}`)[property]
    },
    set(this: FigmaTextStyle, value: never) {
      this[LAYER](`set_${property}`)[property] = value
      this[RESTYLE]()
    }
  })
}

// Figma lists a style's members when a script enumerates it, so its accessors are enumerable.
for (const style of [
  FigmaBaseStyle,
  FigmaPaintStyle,
  FigmaEffectStyle,
  FigmaGridStyle,
  FigmaTextStyle
]) {
  for (const [name, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(style.prototype)
  )) {
    if (descriptor.get && !descriptor.enumerable)
      Object.defineProperty(style.prototype, name, { ...descriptor, enumerable: true })
  }
}
