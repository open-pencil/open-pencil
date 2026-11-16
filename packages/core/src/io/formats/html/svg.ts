import { compact, isEmptyObject } from 'es-toolkit'

import type { DesignDocument, DesignElement } from '@open-pencil/dom-css'
import { serializeNode } from '@open-pencil/dom-css/export'
import type { SceneGraph } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import { parseCSSColor, parseCSSURLReferences } from '@open-pencil/scene-graph/css'
import { ICON_NAME } from '@open-pencil/scene-graph/icons'
import { parseSVGViewBoxValue } from '@open-pencil/scene-graph/parse-path'

import { drawIcon, parseIconName } from '#core/icons'
import { svgIconPaths } from '#core/icons/artwork'
import { extractSVGContent } from '#core/icons/svg'
import { createSVGNodes } from '#core/io/formats/svg/import'
import { svgViewportAttributes } from '#core/vector/vectorize/svg/transform'

import { designElements } from './elements'

/**
 * The ids an element and what it holds refer to: by `href`, as `<use>` does, or by `url(#id)`
 * in any attribute or inline style, as clip paths, masks, filters, and paints do.
 */
function referencedIds(element: DesignElement): string[] {
  return designElements([element]).flatMap((child) => {
    const attrs: Partial<Record<string, string>> = child.attrs
    const href = attrs.href ?? attrs['xlink:href']
    const values = [...Object.values(child.attrs), ...Object.values(child.inlineStyle ?? {})]
    return [
      ...(href?.startsWith('#') ? [href.slice(1)] : []),
      ...values.flatMap(parseCSSURLReferences)
    ]
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
  const color = style?.color
  const own: Record<string, string> = {}
  const paint: Record<string, string> = {}
  for (const property of Object.keys(INITIAL_PAINT)) {
    const value = style?.[property]?.trim()
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
  const color = element.computedStyle?.color
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
  const attrs: Partial<Record<string, string>> = element.attrs
  const named = attrs['data-icon']
  const parsed = named && ICON_NAME.test(named) ? parseIconName(named) : null
  return parsed ? { prefix: parsed.prefix, name: parsed.iconName } : null
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
  const attrs: Partial<Record<string, string>> = element.attrs
  const viewBox = attrs.viewBox ?? attrs.viewbox
  const space = parseSVGViewBoxValue(viewBox) ?? { x: 0, y: 0, ...box }
  const paths = svgIconPaths(extractSVGContent(markup), space, box, svgViewportAttributes(markup))
  if (paths.length === 0) return
  const color = parseCSSColor(element.computedStyle?.color) ?? BLACK
  drawIcon(graph, frameId, { ...named, ...box, paths }, Math.max(box.width, box.height), color)
}

/**
 * Draws artwork as SVG import draws a file, with its groups, clips, masks, and text, into its
 * frame: the import's own frame is dropped and its layers moved into this one.
 */
function drawArtwork(graph: SceneGraph, frameId: string, element: DesignElement, markup: string) {
  const defaultColor = element.computedStyle?.color
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
    designElements(page.children).flatMap((element) =>
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
