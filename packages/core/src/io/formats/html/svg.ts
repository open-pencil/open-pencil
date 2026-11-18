import { XMLSerializer, type Element as XMLElement } from '@xmldom/xmldom'
import { compact, isEmptyObject, omit } from 'es-toolkit'

import type { DesignDocument, DesignElement } from '@open-pencil/dom-css'
import { serializeNode } from '@open-pencil/dom-css/export'
import { elementSVG, type ElementSVG } from '@open-pencil/dom-css/scene-graph'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import {
  parseCSSColor,
  parseCSSURLReferences,
  parseFragmentReference
} from '@open-pencil/scene-graph/css'
import { ICON_NAME, iconLayerName } from '@open-pencil/scene-graph/icons'
import { parseSVGViewBoxValue } from '@open-pencil/scene-graph/parse-path'

import { drawIcon, parseIconName } from '#core/icons'
import { svgIconPaths } from '#core/icons/artwork'
import type { IconMatcher } from '#core/icons/match'
import { extractSVGContent } from '#core/icons/svg'
import { parseSVGDocument } from '#core/io/formats/svg/document'
import { createSVGNodes } from '#core/io/formats/svg/import'
import { parseSVGSize } from '#core/io/formats/svg/metadata'
import { svgViewportAttributes } from '#core/vector/vectorize/svg/transform'

import { designElements } from './elements'

/** The computed properties that can name a definition with `url(#id)`. */
const REFERENCING_PROPERTIES = [
  'fill',
  'stroke',
  'clip-path',
  'mask',
  'filter',
  'marker-start',
  'marker-mid',
  'marker-end'
]

/**
 * The ids an element and what it holds refer to: by `href`, as `<use>` does, or by `url(#id)`
 * in any attribute, inline style, or style a stylesheet gives it, as clip paths, masks,
 * filters, and paints do.
 */
function referencedIds(element: DesignElement): string[] {
  return designElements([element]).flatMap((child) => {
    const attrs: Partial<Record<string, string>> = child.attrs
    const href = attrs.href ?? attrs['xlink:href']
    const computed = REFERENCING_PROPERTIES.map((property) => child.computedStyle?.[property])
    const values = [
      ...Object.values(child.attrs),
      ...Object.values(child.inlineStyle ?? {}),
      ...computed
    ]
    return [...compact([parseFragmentReference(href)]), ...values.flatMap(parseCSSURLReferences)]
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
  const inside = new Set(designElements([element]))
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
 * The text properties SVG `<text>` draws with, which it inherits from the page: the root takes
 * whatever the page computed for it, since its own parent is HTML.
 */
const TEXT_PROPERTIES = ['font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor']

const SVG_STYLE_PROPERTIES = [...Object.keys(INITIAL_PAINT), ...TEXT_PROPERTIES]

/**
 * An SVG element with the paint its page's CSS gives it written into its `style`, and its
 * children likewise. A runtime computes the CSS cascade, which may leave out presentation
 * attributes such as `fill="green"`, as the HTML engine does; so only a value that differs from
 * what the element inherits is CSS's own, and the markup draws the rest. A paint in the
 * element's own color is `currentColor`, so the artwork follows it.
 */
function withComputedPaint(
  element: DesignElement,
  inherited: Readonly<Partial<Record<string, string>>>,
  rootColor: string | undefined
): DesignElement {
  const style = element.computedStyle
  const color = style?.color
  const own: Partial<Record<string, string>> = {}
  const paint: Record<string, string> = {}
  for (const property of SVG_STYLE_PROPERTIES) {
    const value = style?.[property]?.trim()
    const parent = inherited[property]
    own[property] = value ?? parent
    if (value === undefined || value === parent) continue
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
 * An element with `declarations` added to its parsed inline style, which the serializer writes
 * in place of its `style` attribute. Both runtimes parse a `style` attribute into `inlineStyle`,
 * so an element without one had no style to keep.
 */
function withStyle(element: DesignElement, declarations: Record<string, string>): DesignElement {
  if (isEmptyObject(declarations)) return element
  return { ...element, inlineStyle: { ...element.inlineStyle, ...declarations } }
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
  const color = element.computedStyle?.color
  const outside = outsideReferences(element, byId).map((target) =>
    withComputedPaint(target, INITIAL_PAINT, color)
  )
  const defs: DesignElement = { type: 'element', tagName: 'defs', attrs: {}, children: outside }
  // A shape nothing paints is black, as in a browser, rather than in the icon's color. The
  // frame already takes the SVG's own opacity, so its artwork does not apply it again.
  // A parsed inline style is the element's style, which the serializer writes in its place.
  const dropped = element.inlineStyle ? ['opacity', 'style'] : ['opacity']
  const attrs = {
    fill: 'black',
    ...omit(element.attrs, dropped),
    width: String(box.width),
    height: String(box.height)
  }
  const root = {
    ...element,
    attrs,
    inlineStyle: element.inlineStyle && omit(element.inlineStyle, ['opacity']),
    computedStyle: element.computedStyle && omit(element.computedStyle, ['opacity'])
  }
  const painted = withComputedPaint(root, INITIAL_PAINT, color)
  const children = outside.length > 0 ? [defs, ...painted.children] : painted.children
  return serializeNode({ ...painted, children })
}

/** An icon name a page gave the SVG, as OpenPencil's HTML export and Iconify write it. */
function iconName(element: DesignElement): { prefix: string; name: string } | null {
  const attrs: Partial<Record<string, string>> = element.attrs
  const named = attrs['data-icon']
  const parsed = named && ICON_NAME.test(named) ? parseIconName(named) : null
  return parsed ? { prefix: parsed.prefix, name: parsed.iconName } : null
}

/**
 * Draws a named icon's paths into its frame, tinted in its color, and records the icon. Icon
 * paths have no clips or text, so SVG that clips its shapes or sets text is not drawn as an
 * icon, which would lose them; returns whether it was.
 */
function drawNamedIcon(
  graph: SceneGraph,
  frameId: string,
  element: DesignElement,
  named: { prefix: string; name: string },
  markup: string,
  box: { width: number; height: number }
): boolean {
  const content = extractSVGContent(markup)
  if (content.texts.length > 0 || content.paths.some((path) => path.clipPaths?.length)) return false
  const attrs: Partial<Record<string, string>> = element.attrs
  const viewBox = attrs.viewBox ?? attrs.viewbox
  const space = parseSVGViewBoxValue(viewBox) ?? { x: 0, y: 0, ...box }
  const paths = svgIconPaths(content, space, box, svgViewportAttributes(markup))
  if (paths.length === 0) return true
  const color = parseCSSColor(element.computedStyle?.color) ?? BLACK
  drawIcon(graph, frameId, { ...named, ...box, paths }, Math.max(box.width, box.height), color)
  // A layer the page gave no id or class, named only by its tag, takes the icon's name, as an
  // icon placed from the picker does, so swapping it renames it too.
  if (graph.getNode(frameId)?.name === element.tagName) {
    graph.updateNode(frameId, { name: iconLayerName(`${named.prefix}:${named.name}`) })
  }
  return true
}

/**
 * Draws artwork as SVG import draws a file, with its groups, clips, masks, and text, into its
 * frame: the import's own frame is dropped and its layers moved into this one.
 */
/** Paints every shape an SVG draws in one color, as a CSS mask shows its background through them. */
function paintShapes(root: XMLElement, paint: string): void {
  // Shapes that name no fill take the root's, black by default.
  root.setAttribute('fill', paint)
  for (const element of Array.from(root.getElementsByTagName('*'))) {
    for (const attribute of ['fill', 'stroke']) {
      const value = element.getAttribute(attribute)
      if (value && value !== 'none') element.setAttribute(attribute, paint)
    }
  }
}

/**
 * The SVG an element draws, at the size of the layer it became: an image's picture, or a mask's
 * shapes in `paint`. Both scale to the element's box, so an SVG that gives only a size scales from
 * a `viewBox` of that size.
 */
function elementSVGMarkup(
  { markup, paint }: ElementSVG,
  box: { width: number; height: number }
): string | null {
  const root = parseSVGDocument(markup)?.documentElement
  if (!root) return null
  if (!root.hasAttribute('viewBox')) {
    const { width, height } = parseSVGSize(markup, box)
    root.setAttribute('viewBox', `0 0 ${width} ${height}`)
  }
  root.setAttribute('width', String(box.width))
  root.setAttribute('height', String(box.height))
  if (paint) paintShapes(root, paint)
  return new XMLSerializer().serializeToString(root)
}

function drawArtwork(graph: SceneGraph, frameId: string, element: DesignElement, markup: string) {
  const defaultColor = element.computedStyle?.color
  const imported = createSVGNodes(graph, frameId, markup, defaultColor ? { defaultColor } : {})
  if (!imported) return
  for (const layer of graph.getChildren(imported.id)) graph.reparentNode(layer.id, frameId)
  graph.deleteNode(imported.id)
}

/**
 * Draws each inline SVG, image showing an SVG, and element an SVG masks, HTML import built a frame
 * for into that frame, at the size layout and
 * placement gave it, with `currentColor` in the element's color, `<use>` and `url()` reaching
 * definitions elsewhere in the page, and the paint the page's CSS gives each shape. An SVG that
 * is an icon, because the page names it, as `data-icon="lucide:save"`, or because `matchIcon`
 * finds the Iconify icon it draws, becomes that icon: its own paths drawn through the pipeline
 * Iconify icons use, so it can be swapped, recolored, and exported by name. Other SVG is artwork,
 * drawn as SVG import draws it.
 */
export async function drawInlineSVGs(
  graph: SceneGraph,
  svgs: ReadonlyMap<string, DesignElement>,
  page: DesignDocument,
  matchIcon?: IconMatcher
): Promise<void> {
  if (svgs.size === 0) return
  const byId = new Map(
    designElements(page.children).flatMap((element) =>
      element.attrs.id ? [[element.attrs.id, element] as const] : []
    )
  )
  const drawn = [...svgs].flatMap(([frameId, element]) => {
    const frame = graph.getNode(frameId)
    if (!frame || frame.width <= 0 || frame.height <= 0) return []
    const box = { width: frame.width, height: frame.height }
    const drawn = elementSVG(element)
    const markup = drawn ? elementSVGMarkup(drawn, box) : svgMarkup(element, byId, box)
    return markup ? [{ frameId, element, box, markup }] : []
  })
  const unnamed = drawn.filter(({ element }) => !iconName(element))
  const matched = matchIcon ? await matchIcon(unnamed.map(({ markup }) => markup)) : []
  const found = new Map(unnamed.map(({ frameId }, i) => [frameId, matched[i] ?? null]))
  for (const { frameId, element, box, markup } of drawn) {
    const name = found.get(frameId)
    const parsed = name ? parseIconName(name) : null
    const icon = iconName(element) ?? (parsed && { prefix: parsed.prefix, name: parsed.iconName })
    if (!icon || !drawNamedIcon(graph, frameId, element, icon, markup, box)) {
      drawArtwork(graph, frameId, element, markup)
    }
  }
}
