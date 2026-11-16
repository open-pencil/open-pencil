import { compact, isEmptyObject } from 'es-toolkit'

import {
  serializeNode,
  type DesignDocument,
  type DesignElement,
  type DesignNode
} from '@open-pencil/dom-css'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { parseCSSColor } from '@open-pencil/scene-graph/css'
import { ICON_NAME } from '@open-pencil/scene-graph/icons'

import { drawIcon } from '#core/icons'
import { svgIconPaths } from '#core/icons/artwork'
import { extractSVGContent } from '#core/icons/svg'
import { createSVGNodes } from '#core/io/formats/svg/import'
import { parseSVGViewBoxValue } from '#core/io/formats/svg/metadata'
import { svgViewportAttributes } from '#core/vector/vectorize/svg/transform'

function isElement(node: DesignNode): node is DesignElement {
  return node.type === 'element'
}

function* elementsIn(nodes: readonly DesignNode[]): Generator<DesignElement> {
  for (const node of nodes.filter(isElement)) {
    yield node
    yield* elementsIn(node.children)
  }
}

/** The element each `href="#id"` in `element` points at. */
/** An attribute or style value an element may not have. */
function valueOf(values: Readonly<Record<string, string>> | undefined, name: string) {
  return values && Object.hasOwn(values, name) ? values[name] : undefined
}

/** A local `url(#id)` reference, as `clip-path`, `mask`, `filter`, and gradient paints write it. */
const URL_REFERENCE = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g

/** The ids an element and what it holds refer to: by `href`, or by `url(#id)` in any attribute. */
function referencedIds(element: DesignElement): string[] {
  return [...elementsIn([element])].flatMap((child) => {
    const href = valueOf(child.attrs, 'href') ?? valueOf(child.attrs, 'xlink:href')
    const linked = href?.startsWith('#') ? [href.slice(1)] : []
    const values = [...Object.values(child.attrs), ...Object.values(child.inlineStyle ?? {})]
    const urls = values.flatMap((value) => [...value.matchAll(URL_REFERENCE)].map((m) => m[1]))
    return [...linked, ...urls]
  })
}

/**
 * The elements outside an SVG that its `<use>` and paint references reach, as a page keeps an
 * icon sprite's `<symbol>`s in one hidden SVG and draws them from others, with what they reach.
 */
function outsideReferences(
  element: DesignElement,
  byId: ReadonlyMap<string, DesignElement>
): DesignElement[] {
  const inside = new Set(elementsIn([element]))
  const reached = new Map<string, DesignElement>()
  const pending = referencedIds(element)
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const target = byId.get(id)
    if (!target || inside.has(target) || reached.has(id)) continue
    reached.set(id, target)
    for (const next of referencedIds(target)) pending.push(next)
  }
  return [...reached.values()]
}

/** The SVG paint properties, with the computed values they start from (SVG 2 §13). */
const INITIAL_PAINT: Readonly<Record<string, string>> = {
  fill: 'rgb(0, 0, 0)',
  'fill-opacity': '1',
  'fill-rule': 'nonzero',
  stroke: 'none',
  'stroke-width': '1px',
  'stroke-opacity': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-dasharray': 'none'
}

/**
 * An SVG element with the paint its page's CSS gives it written into its `style`, and its
 * children likewise. A runtime computes the CSS cascade, which may leave out presentation
 * attributes such as `fill="green"`, as the HTML engine does; so only a value that differs from
 * what the element inherits is CSS's own, and the markup draws the rest. A paint in the
 * element's own color is `currentColor`, so the artwork follows it.
 */
function withComputedPaint(
  element: DesignElement,
  inherited: Readonly<Record<string, string>>,
  rootColor: string | undefined
): DesignElement {
  const style = element.computedStyle
  const color = valueOf(style, 'color')
  const own: Record<string, string> = {}
  const paint: Record<string, string> = {}
  for (const property of Object.keys(INITIAL_PAINT)) {
    const value = valueOf(style, property)?.trim()
    own[property] = value ?? inherited[property]
    if (value === undefined || value === inherited[property]) continue
    // The artwork's color tints `currentColor`, so only paint in that color follows it; a shape
    // with a color of its own keeps the paint it resolved to.
    const isColor = property === 'fill' || property === 'stroke'
    paint[property] = isColor && value === color && color === rootColor ? 'currentColor' : value
  }
  return {
    ...withStyle(element, paint),
    children: element.children.map((child) =>
      child.type === 'element' ? withComputedPaint(child, own, rootColor) : child
    )
  }
}

/**
 * An element with `declarations` added to its style, where the serializer reads it: its parsed
 * inline style when it has one, which replaces the `style` attribute, else that attribute.
 */
function withStyle(element: DesignElement, declarations: Record<string, string>): DesignElement {
  if (isEmptyObject(declarations)) return element
  if (element.inlineStyle && !isEmptyObject(element.inlineStyle)) {
    return { ...element, inlineStyle: { ...element.inlineStyle, ...declarations } }
  }
  const css = Object.entries(declarations).map(([property, value]) => `${property}:${value}`)
  return {
    ...element,
    attrs: { ...element.attrs, style: compact([element.attrs.style, ...css]).join(';') }
  }
}

/**
 * The markup of an inline SVG at the size layout gave it, with the definitions it uses from
 * elsewhere in the page, so a symbol drawn through `<use>` fits the viewport the page drew.
 */
function svgMarkup(
  element: DesignElement,
  byId: ReadonlyMap<string, DesignElement>,
  box: { width: number; height: number }
): string {
  const color = valueOf(element.computedStyle, 'color')
  const outside = outsideReferences(element, byId).map((target) =>
    withComputedPaint(target, INITIAL_PAINT, color)
  )
  const defs: DesignElement = { type: 'element', tagName: 'defs', attrs: {}, children: outside }
  // A shape nothing paints is black, as in a browser, rather than in the icon's color.
  const attrs = {
    fill: 'black',
    ...element.attrs,
    width: String(box.width),
    height: String(box.height)
  }
  const painted = withComputedPaint({ ...element, attrs }, INITIAL_PAINT, color)
  const children = outside.length > 0 ? [defs, ...painted.children] : painted.children
  return serializeNode({ ...painted, children })
}

/** An icon name a page gave the SVG, as OpenPencil's HTML export and Iconify write it. */
function iconName(element: DesignElement): { prefix: string; name: string } | null {
  const named = element.attrs['data-icon']
  if (!named || !ICON_NAME.test(named)) return null
  const [prefix, name] = named.split(':')
  return { prefix, name }
}

/** Draws a named icon's paths into its frame, tinted in its color, and records the icon. */
function drawNamedIcon(
  graph: SceneGraph,
  frameId: string,
  element: DesignElement,
  named: { prefix: string; name: string },
  markup: string,
  box: { width: number; height: number }
): void {
  const viewBox = valueOf(element.attrs, 'viewBox') ?? valueOf(element.attrs, 'viewbox')
  const space = parseSVGViewBoxValue(viewBox) ?? { x: 0, y: 0, ...box }
  const paths = svgIconPaths(extractSVGContent(markup), space, box, svgViewportAttributes(markup))
  if (paths.length === 0) return
  const color = parseCSSColor(valueOf(element.computedStyle, 'color')) ?? BLACK
  drawIcon(graph, frameId, { ...named, ...box, paths }, Math.max(box.width, box.height), color)
}

/**
 * Draws artwork as SVG import draws a file, with its groups, clips, masks, and text, into its
 * frame: the import's own frame is dropped and its layers moved into this one.
 */
function drawArtwork(graph: SceneGraph, frameId: string, element: DesignElement, markup: string) {
  const defaultColor = valueOf(element.computedStyle, 'color')
  const imported = createSVGNodes(graph, frameId, markup, defaultColor ? { defaultColor } : {})
  if (!imported) return
  for (const layer of graph.getChildren(imported.id)) graph.reparentNode(layer.id, frameId)
  graph.deleteNode(imported.id)
}

/**
 * Draws each inline SVG HTML import built a frame for into that frame, at the size layout and
 * placement gave it, with `currentColor` in the element's color, `<use>` and `url()` reaching
 * definitions elsewhere in the page, and the paint the page's CSS gives each shape. An SVG a page
 * names as an icon, as `data-icon="lucide:save"`, becomes that icon, drawn through the path
 * pipeline Iconify icons use, so it can be swapped, recolored, and exported by name; other SVG
 * is artwork, drawn as SVG import draws it.
 */
export function drawInlineSVGs(
  graph: SceneGraph,
  svgs: ReadonlyMap<string, DesignElement>,
  page: DesignDocument
): void {
  if (svgs.size === 0) return
  const byId = new Map(
    [...elementsIn(page.children)].flatMap((element) =>
      element.attrs.id ? [[element.attrs.id, element] as const] : []
    )
  )
  for (const [frameId, element] of svgs) {
    const frame = graph.getNode(frameId)
    if (!frame || frame.width <= 0 || frame.height <= 0) continue
    const box = { width: frame.width, height: frame.height }
    const markup = svgMarkup(element, byId, box)
    const named = iconName(element)
    if (named) drawNamedIcon(graph, frameId, element, named, markup, box)
    else drawArtwork(graph, frameId, element, markup)
  }
}
