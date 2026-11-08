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
import { figmaBoundVariables, setPaintBindings } from '#core/figma-api/variables/bindings'
import type { FigmaVariableAlias } from '#core/figma-api/variables/values'

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

// Each style's host, kept off the handle so scripts reach only the members of Figma's styles.
const hosts = new WeakMap<FigmaBaseStyle, StyleHost>()

function hostOf(style: FigmaBaseStyle): StyleHost {
  const host = hosts.get(style)
  if (!host) throw new Error(`The style with id "${style.id}" has no host`)
  return host
}

/** The node holding the style's values, or Figma's refusal once the style is gone. */
function styleNode(style: FigmaBaseStyle, method: string): SceneNode {
  const type = STYLE_TYPES[style.type]
  for (const node of hostOf(style).graph.getAllNodes())
    if (node.sharedStyleType === type && node.source.id === style.id) return node
  throw new Error(`in ${method}: The style with id "${style.id}" does not exist`)
}

/** The style's node as a layer, whose setters check and store its values. */
function styleLayer(style: FigmaBaseStyle, method: string): FigmaNodeProxy {
  return hostOf(style).wrapNode(styleNode(style, method).id)
}

/** Brings what uses the style up to its values, after they changed. */
function restyle(style: FigmaBaseStyle): void {
  const host = hostOf(style)
  restyleUsers(host.graph, styleNode(style, 'restyle'), host.updateLayer)
}

/**
 * Figma's `BaseStyle`: a shared style the document holds, read and written through the node that
 * keeps its values. A change to the style reaches every layer and text range that uses it.
 */
export abstract class FigmaBaseStyle {
  readonly id: string
  abstract readonly type: FigmaStyleType
  readonly remote = false
  readonly documentationLinks: readonly never[] = Object.freeze([])

  constructor(host: StyleHost, id: string) {
    hosts.set(this, host)
    this.id = id
  }

  /** The variables the style's values use; only an effect style lists any. */
  get boundVariables(): Readonly<Record<string, readonly FigmaVariableAlias[]>> {
    return Object.freeze({})
  }

  get name(): string {
    return styleNode(this, 'get_name').name
  }

  set name(value: string) {
    const node = styleNode(this, 'set_name')
    const name = parseFigma(v.string(), value, 'set_name', 'name')
    hostOf(this).graph.updateNode(node.id, { name })
  }

  get description(): string {
    return styleNode(this, 'get_description').symbolDescription
  }

  /** Figma ignores a description that is not a string, without an error. */
  set description(value: string) {
    const node = styleNode(this, 'set_description')
    if (typeof value === 'string')
      hostOf(this).graph.updateNode(node.id, { symbolDescription: value })
  }

  /** The key a library publishes the style by: the hex part of a local style's ID. */
  get key(): string {
    styleNode(this, 'get_key')
    return KEY.exec(this.id)?.[1] ?? ''
  }

  /** @deprecated Figma's synchronous form of `getStyleConsumersAsync`. */
  get consumers(): FigmaStyleConsumer[] {
    return styleConsumers(hostOf(this).graph, styleNode(this, 'get_consumers')).map(
      ({ node, fields }) => ({
        node: hostOf(this).wrapNode(node.id),
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
    const style = styleNode(this, 'remove')
    releaseUsers(hostOf(this).graph, style, hostOf(this).updateLayer)
    hostOf(this).graph.deleteNode(style.id)
    hostOf(this).forgetStyle(this.id)
  }
}

export class FigmaPaintStyle extends FigmaBaseStyle {
  readonly type = 'PAINT'

  get paints(): readonly FigmaPaint[] {
    const node = styleNode(this, 'get_paints')
    return Object.freeze(figmaFills(hostOf(this).graph, node).map((paint) => Object.freeze(paint)))
  }

  set paints(value: readonly FigmaPaint[]) {
    const node = styleNode(this, 'set_paints')
    const fills = parseFigmaPaints(value, 'set_paints', 'paints')
    hostOf(this).graph.updateNode(node.id, { fills })
    // A paint bound to a variable keeps following it, as the style's consumers then do.
    setPaintBindings(hostOf(this).graph, node, 'fills', value)
    restyle(this)
  }
}

export class FigmaEffectStyle extends FigmaBaseStyle {
  readonly type = 'EFFECT'

  get effects(): FigmaNodeProxy['effects'] {
    return styleLayer(this, 'get_effects').effects
  }

  set effects(value: FigmaNodeProxy['effects']) {
    styleLayer(this, 'set_effects').effects = value
    restyle(this)
  }

  /** Every variable the style's effects use, each once, as a layer lists its own. */
  override get boundVariables(): Readonly<Record<string, readonly FigmaVariableAlias[]>> {
    const { effects } = figmaBoundVariables(styleNode(this, 'get_boundVariables'))
    const bound: Record<string, readonly FigmaVariableAlias[]> = {}
    if (Array.isArray(effects)) bound.effects = effects
    return Object.freeze(bound)
  }
}

export class FigmaGridStyle extends FigmaBaseStyle {
  readonly type = 'GRID'

  get layoutGrids(): FigmaNodeProxy['layoutGrids'] {
    return styleLayer(this, 'get_layoutGrids').layoutGrids
  }

  set layoutGrids(value: FigmaNodeProxy['layoutGrids']) {
    styleLayer(this, 'set_layoutGrids').layoutGrids = value
    restyle(this)
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
      return styleLayer(this, `get_${property}`)[property]
    },
    set(this: FigmaTextStyle, value: never) {
      styleLayer(this, `set_${property}`)[property] = value
      restyle(this)
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
