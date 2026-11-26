import type { DesignElement, DesignElementMode } from '#dom-css/types'
import { isEqual } from 'es-toolkit/predicate'

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseCSSNumber, parseCSSShadows, splitCSSLayers } from '@open-pencil/scene-graph/css'
import { ICON_PAINTS, type IconPaint } from '@open-pencil/scene-graph/icons'
import { effectBindingField } from '@open-pencil/scene-graph/variables'

import { drawsBorder, firstStrokeProperty, ringOf } from '../box'
import { anyCSSColor, mergedStyle } from '../css-values'
import { maskSVG } from '../pictures'
import { colorPart, referencedProperty } from './expression'
import { ThemeVariables, type HTMLTheme, type ModeColor } from './theme'

/** The element each layer was built from; its text layers come from the element that holds them. */
export type LayerSources = Map<string, DesignElement>

type ModeStyle = Required<DesignElementMode>

/** What an element computes to in each mode of the theme, or null when a mode left it out. */
function inModes(element: DesignElement, count: number): ModeStyle[] | null {
  const own = { computedStyle: mergedStyle(element), references: element.references ?? {} }
  const modes = [own, ...(element.modes ?? [])]
  if (modes.length !== count) return null
  const styled: ModeStyle[] = []
  for (const { computedStyle, references } of modes) {
    if (!computedStyle) return null
    styled.push({ computedStyle, references: references ?? {} })
  }
  return styled
}

const CORNERS = [
  ['topLeftRadius', 'border-top-left-radius'],
  ['topRightRadius', 'border-top-right-radius'],
  ['bottomRightRadius', 'border-bottom-right-radius'],
  ['bottomLeftRadius', 'border-bottom-left-radius']
] as const

/** A number a layer's field takes, and the properties that all set it. */
interface NumberSlot {
  field: string
  properties: readonly string[]
}

const slot = (field: string, ...properties: string[]): NumberSlot => ({ field, properties })

/** Where a layer's numbers come from. */
function numberSlots(node: SceneNode): NumberSlot[] {
  if (node.type === 'TEXT') {
    return [
      slot('fontSize', 'font-size'),
      slot('lineHeight', 'line-height'),
      slot('letterSpacing', 'letter-spacing'),
      slot('opacity', 'opacity')
    ]
  }
  // A layer whose corners are not independent draws its one radius, which all four set.
  const corners = node.independentCorners
    ? CORNERS.map(([field, property]) => slot(field, property))
    : [slot('cornerRadius', ...CORNERS.map(([, property]) => property))]
  const slots = [slot('opacity', 'opacity'), ...corners]
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return slots
  const horizontal = node.layoutMode === 'HORIZONTAL'
  slots.push(
    slot('paddingTop', 'padding-top'),
    slot('paddingRight', 'padding-right'),
    slot('paddingBottom', 'padding-bottom'),
    slot('paddingLeft', 'padding-left'),
    slot('itemSpacing', horizontal ? 'column-gap' : 'row-gap')
  )
  if (node.layoutWrap === 'WRAP')
    slots.push(slot('counterAxisSpacing', horizontal ? 'row-gap' : 'column-gap'))
  return slots
}

/** Layout rounds and the engine keeps single precision. */
const NUMBER_TOLERANCE = 0.01

/** A field's number, in pixels for a text length. */
function numberIn(node: SceneNode, field: string): number | null {
  const value: unknown = node[field as keyof SceneNode]
  if (typeof value === 'number') return value
  const length = field === 'lineHeight' ? node.lineHeight : node.letterSpacing
  if (field !== 'lineHeight' && field !== 'letterSpacing') return null
  return length?.unit === 'PIXELS' ? length.value : null
}

function isSameNumber(value: number | undefined, other: number | null): boolean {
  return value !== undefined && other !== null && Math.abs(value - other) <= NUMBER_TOLERANCE
}

class Binder {
  readonly #graph: SceneGraph
  readonly #theme: HTMLTheme
  readonly #variables: ThemeVariables

  constructor(graph: SceneGraph, theme: HTMLTheme) {
    this.#graph = graph
    this.#theme = theme
    this.#variables = new ThemeVariables(graph, theme)
  }

  #isColor = (property: string) => this.#variables.named(property)?.type === 'COLOR'

  /** What a color is in each mode, or null when nothing about it is worth a variable. */
  #colors(element: DesignElement, property: string): ModeColor[] | null {
    const modes = inModes(element, this.#theme.modes.length)
    if (!modes) return null
    const colors: ModeColor[] = []
    for (const other of modes) {
      const color = anyCSSColor(other.computedStyle[property])
      if (!color) return null
      const reference = other.references[property]
      colors.push({ expression: reference ? colorPart(reference, this.#isColor) : null, color })
    }
    return this.#worthBinding(colors) ? colors : null
  }

  #worthBinding(colors: readonly ModeColor[]): boolean {
    if (colors.every(({ color }) => color.a === 0)) return false
    return (
      colors.some(({ expression }) => expression !== null) ||
      !colors.every(({ color }) => isEqual(color, colors[0].color))
    )
  }

  #bindColor(node: SceneNode, field: string, colors: ModeColor[] | null): void {
    if (colors) this.#graph.bindVariable(node.id, field, this.#variables.forColors(colors).id)
  }

  #bindPaint(node: SceneNode, list: 'fills' | 'strokes', colors: ModeColor[] | null): void {
    // A background the first mode leaves transparent has no paint yet, and is the lowest one.
    if (colors?.[0].color.a === 0 && list === 'fills') {
      const { color } = colors[0]
      const paint: Fill = { type: 'SOLID', color, opacity: 0, visible: true }
      this.#graph.updateNode(node.id, { fills: [paint, ...node.fills] })
    }
    const paint = node[list].at(0)
    if (paint?.type === 'SOLID') this.#bindColor(node, `${list}/0/color`, colors)
  }

  /** Binds numbers a single property gives, where its variable holds the layer's in every mode. */
  #bindNumbers(node: SceneNode, element: DesignElement): void {
    for (const { field, properties } of numberSlots(node)) {
      const [property = ''] = properties
      const modes = inModes(element, this.#theme.modes.length) ?? []
      const names = modes.flatMap((other) =>
        properties.map((each) => referencedProperty(other.references[each]))
      )
      const variable = this.#variables.named(names.at(0) ?? null)
      if (variable?.type !== 'FLOAT' || names.some((name) => name !== names[0])) continue
      const others = modes.slice(1).map((other) => parseCSSNumber(other.computedStyle[property]))
      const expected = [numberIn(node, field), ...others]
      // A text length or a radius takes a length; a unitless line height is no length.
      const unit = field === 'opacity' ? 'number' : 'length'
      const values = this.#variables.numbers(names[0] ?? '', unit)
      if (expected.length !== values.length) continue
      if (values.every((value, index) => isSameNumber(value, expected[index])))
        this.#graph.bindVariable(node.id, field, variable.id)
    }
  }

  /**
   * Binds each shadow's color, matching the page's shadow list with the effects it became, and a
   * ring that became the outside stroke of a box without a border with that stroke.
   */
  #bindShadows(node: SceneNode, element: DesignElement, property: 'box-shadow' | 'text-shadow') {
    const modes = inModes(element, this.#theme.modes.length)
    if (!modes) return
    const lists = modes.map((other) => ({
      computed: splitCSSLayers(other.computedStyle[property] ?? ''),
      written: splitCSSLayers(other.references[property] ?? '')
    }))
    const first = lists[0].computed.map((layer) => parseCSSShadows(layer, 'srgb').at(0))
    const drawn = first.filter((shadow) => shadow !== undefined)
    const bordered = drawsBorder(element, modes[0].computedStyle)
    const ring = property === 'box-shadow' ? ringOf(drawn, bordered) : null
    let effect = 0
    for (const [index, initial] of first.entries()) {
      if (!initial) continue
      const shadows = lists.map(({ computed, written }) => {
        const shadow = parseCSSShadows(computed.at(index), 'srgb').at(0)
        const own = written.length === computed.length ? written[index] : ''
        return shadow && { expression: colorPart(own, this.#isColor), color: shadow.color }
      })
      const field = initial === ring ? 'strokes/0/color' : effectBindingField(effect++, 'color')
      const colors = shadows.filter((shadow) => shadow !== undefined)
      if (colors.length === shadows.length && this.#worthBinding(colors))
        this.#bindColor(node, field, colors)
    }
  }

  bindLayer(node: SceneNode, element: DesignElement): void {
    const isText = node.type === 'TEXT'
    this.#bindPaint(node, 'fills', this.#colors(element, isText ? 'color' : 'background-color'))
    const style = mergedStyle(element)
    // A border that draws nothing has no stroke, which a ring may have become instead.
    const stroke = isText || !drawsBorder(element, style) ? null : firstStrokeProperty(style)
    if (stroke) this.#bindPaint(node, 'strokes', this.#colors(element, stroke))
    this.#bindShadows(node, element, isText ? 'text-shadow' : 'box-shadow')
    this.#bindNumbers(node, element)
  }

  /**
   * Binds the paints inline SVG draws in its element's color, which `tinted` names, to that
   * color; a mask shows its background through every shape it draws.
   */
  bindArtwork(
    frameId: string,
    element: DesignElement,
    tinted: ReadonlyMap<string, readonly IconPaint[]>
  ): void {
    const mask = maskSVG(element) !== null
    const colors = this.#colors(element, mask ? 'background-color' : 'color')
    if (!colors) return
    for (const child of this.#graph.getChildren(frameId)) {
      this.#bindTinted(child, colors, mask ? null : tinted)
    }
  }

  #bindTinted(
    node: SceneNode,
    colors: ModeColor[],
    tinted: ReadonlyMap<string, readonly IconPaint[]> | null
  ): void {
    const paints = tinted ? (tinted.get(node.id) ?? []) : ICON_PAINTS
    for (const paint of paints) {
      const list = paint === 'fill' ? 'fills' : 'strokes'
      for (const [index, { type, opacity }] of node[list].entries()) {
        // A bound paint takes its variable's alpha as its opacity, so one with an opacity of its
        // own, such as `fill-opacity`, keeps its color.
        if (type === 'SOLID' && Math.abs(opacity - colors[0].color.a) <= NUMBER_TOLERANCE)
          this.#bindColor(node, `${list}/${index}/color`, colors)
      }
    }
    for (const child of this.#graph.getChildren(node.id)) this.#bindTinted(child, colors, tinted)
  }
}

/** Binds a layer made after the others were bound, such as a page's window, to its element. */
export type ThemeLayerBinder = (node: SceneNode, element: DesignElement) => void

/**
 * Imports a page's custom properties as variables, and binds each layer's colors and numbers to
 * the ones its styles name, in the modes the page was styled in. Call it once the layers are laid
 * out and their artwork is drawn; it returns a binder for layers made later.
 */
export function bindThemeVariables(
  graph: SceneGraph,
  theme: HTMLTheme,
  sources: LayerSources,
  svgs: ReadonlyMap<string, DesignElement>,
  tinted: ReadonlyMap<string, readonly IconPaint[]>
): ThemeLayerBinder {
  const binder = new Binder(graph, theme)
  for (const [nodeId, element] of sources) {
    const node = graph.getNode(nodeId)
    if (node) binder.bindLayer(node, element)
  }
  for (const [frameId, element] of svgs) binder.bindArtwork(frameId, element, tinted)
  return (node, element) => binder.bindLayer(node, element)
}
