import type { DesignDocument, DesignElement } from '#dom-css/types'
import { isEqual } from 'es-toolkit/predicate'

import type { Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { parseCSSShadows, splitCSSLayers } from '@open-pencil/scene-graph/css'
import { effectBindingField } from '@open-pencil/scene-graph/variables'

import { firstStrokeProperty } from '../box'
import { anyCSSColor, mergedStyle } from '../css-values'
import { maskSVG } from '../pictures'
import { colorPart, referencedProperty } from './expression'
import { ThemeVariables, type HTMLTheme, type ModeColor } from './theme'

/** The element each layer was built from; its text layers come from the element that holds them. */
export type LayerSources = Map<string, DesignElement>

function elementsOf(parent: DesignDocument | DesignElement): DesignElement[] {
  return parent.children.filter((child) => child.type === 'element')
}

/**
 * Each element of the first mode's page with the same one in every mode, by position; elements a
 * mode adds or removes, such as generated content, end the pairing among their siblings.
 */
function counterparts(modes: readonly DesignDocument[]): Map<DesignElement, DesignElement[]> {
  const pairs = new Map<DesignElement, DesignElement[]>()
  const pair = (parents: readonly (DesignDocument | DesignElement)[]) => {
    const [first, ...others] = parents.map(elementsOf)
    for (const [index, element] of first.entries()) {
      const same = others.map((siblings) => siblings.at(index))
      if (!same.every((other) => other?.tagName === element.tagName)) return
      const all = [element, ...same.filter((other) => other !== undefined)]
      pairs.set(element, all)
      pair(all)
    }
  }
  pair(modes)
  return pairs
}

/** Where a layer's number comes from: the field that binds, and the properties that all set it. */
function numberSlots(node: SceneNode): [field: string, property: string][] {
  if (node.type === 'TEXT') {
    return [
      ['fontSize', 'font-size'],
      ['lineHeight', 'line-height'],
      ['letterSpacing', 'letter-spacing'],
      ['opacity', 'opacity']
    ]
  }
  const slots: [string, string][] = [
    ['opacity', 'opacity'],
    ['topLeftRadius', 'border-top-left-radius'],
    ['topRightRadius', 'border-top-right-radius'],
    ['bottomRightRadius', 'border-bottom-right-radius'],
    ['bottomLeftRadius', 'border-bottom-left-radius']
  ]
  if (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL') return slots
  const horizontal = node.layoutMode === 'HORIZONTAL'
  slots.push(
    ['paddingTop', 'padding-top'],
    ['paddingRight', 'padding-right'],
    ['paddingBottom', 'padding-bottom'],
    ['paddingLeft', 'padding-left'],
    ['itemSpacing', horizontal ? 'column-gap' : 'row-gap']
  )
  if (node.layoutWrap === 'WRAP')
    slots.push(['counterAxisSpacing', horizontal ? 'row-gap' : 'column-gap'])
  return slots
}

/** Layout rounds and the engine keeps single precision. */
const NUMBER_TOLERANCE = 0.01

class Binder {
  readonly #graph: SceneGraph
  readonly #theme: HTMLTheme
  readonly #variables: ThemeVariables
  readonly #counterparts: Map<DesignElement, DesignElement[]>

  constructor(graph: SceneGraph, theme: HTMLTheme) {
    this.#graph = graph
    this.#theme = theme
    this.#variables = new ThemeVariables(graph, theme)
    this.#counterparts = counterparts(theme.modes.map((mode) => mode.styled))
  }

  #isColor = (property: string) => this.#variables.named(property)?.type === 'COLOR'

  /** What a color is in each mode, or null when nothing about it is worth a variable. */
  #colors(element: DesignElement, property: string): ModeColor[] | null {
    const same = this.#counterparts.get(element)
    if (same?.length !== this.#theme.modes.length) return null
    const colors: ModeColor[] = []
    for (const other of same) {
      const color = anyCSSColor(mergedStyle(other)[property])
      if (!color) return null
      const reference = other.references?.[property]
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

  /** Binds numbers a single property gives and that hold its value still. */
  #bindNumbers(node: SceneNode, element: DesignElement): void {
    for (const [field, property] of numberSlots(node)) {
      const same = this.#counterparts.get(element)
      const names = same?.map((other) => referencedProperty(other.references?.[property])) ?? []
      const variable = this.#variables.named(names.at(0) ?? null)
      if (variable?.type !== 'FLOAT' || names.some((name) => name !== names[0])) continue
      const value = this.#graph.resolveNumberVariable(variable.id)
      const current = node[field as keyof SceneNode]
      if (typeof value !== 'number' || typeof current !== 'number') continue
      if (Math.abs(value - current) <= NUMBER_TOLERANCE)
        this.#graph.bindVariable(node.id, field, variable.id)
    }
  }

  /** Binds each shadow's color, matching the page's shadow list with the effects it became. */
  #bindShadows(node: SceneNode, element: DesignElement, property: 'box-shadow' | 'text-shadow') {
    const same = this.#counterparts.get(element)
    if (same?.length !== this.#theme.modes.length) return
    const lists = same.map((other) => ({
      computed: splitCSSLayers(mergedStyle(other)[property] ?? ''),
      written: splitCSSLayers(other.references?.[property] ?? '')
    }))
    let effect = 0
    for (const index of lists[0].computed.keys()) {
      const shadows = lists.map(({ computed, written }) => {
        const shadow = parseCSSShadows(computed.at(index), 'srgb').at(0)
        const own = written.length === computed.length ? written[index] : ''
        return shadow && { expression: colorPart(own, this.#isColor), color: shadow.color }
      })
      if (!shadows[0]) continue
      const field = effectBindingField(effect++, 'color')
      const colors = shadows.filter((shadow) => shadow !== undefined)
      if (colors.length === shadows.length && this.#worthBinding(colors))
        this.#bindColor(node, field, colors)
    }
  }

  bindLayer(node: SceneNode, element: DesignElement): void {
    const isText = node.type === 'TEXT'
    this.#bindPaint(node, 'fills', this.#colors(element, isText ? 'color' : 'background-color'))
    const stroke = isText ? null : firstStrokeProperty(mergedStyle(element))
    if (stroke) this.#bindPaint(node, 'strokes', this.#colors(element, stroke))
    if (node.effects.length > 0)
      this.#bindShadows(node, element, isText ? 'text-shadow' : 'box-shadow')
    this.#bindNumbers(node, element)
  }

  /** Binds the paints inline SVG draws in its element's color, which `currentColor` stands for. */
  bindArtwork(frameId: string, element: DesignElement): void {
    const property = maskSVG(element) ? 'background-color' : 'color'
    const colors = this.#colors(element, property)
    if (!colors) return
    for (const child of this.#graph.getChildren(frameId)) this.#bindPaintsIn(child, colors)
  }

  #bindPaintsIn(node: SceneNode, colors: ModeColor[]): void {
    const own = { ...colors[0].color, a: 1 }
    for (const list of ['fills', 'strokes'] as const) {
      for (const [index, paint] of node[list].entries()) {
        if (paint.type === 'SOLID' && isEqual({ ...paint.color, a: 1 }, own))
          this.#bindColor(node, `${list}/${index}/color`, colors)
      }
    }
    for (const child of this.#graph.getChildren(node.id)) this.#bindPaintsIn(child, colors)
  }
}

/**
 * Imports a page's custom properties as variables, and binds each layer's colors and numbers to
 * the ones its styles name, in the modes the page was styled in. Call it once the layers are laid
 * out and their artwork is drawn.
 */
export function bindThemeVariables(
  graph: SceneGraph,
  theme: HTMLTheme,
  sources: LayerSources,
  svgs: ReadonlyMap<string, DesignElement>
): void {
  const binder = new Binder(graph, theme)
  for (const [nodeId, element] of sources) {
    const node = graph.getNode(nodeId)
    if (node) binder.bindLayer(node, element)
  }
  for (const [frameId, element] of svgs) binder.bindArtwork(frameId, element)
}
