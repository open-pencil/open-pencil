import { pick } from 'es-toolkit'
import { isValid, toUint8Array } from 'js-base64'

import {
  SceneGraph,
  type Effect,
  type ImageScaleMode,
  type SceneNode
} from '@open-pencil/scene-graph'
import { TRANSPARENT } from '@open-pencil/scene-graph/constants'
import { parseCSSAlignSelf, parseCSSNumber, parseCSSShadows } from '@open-pencil/scene-graph/css'
import { blurRadiusForSigma } from '@open-pencil/scene-graph/geometry'
import { computeImageHash } from '@open-pencil/scene-graph/images'

import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from '../types'
import {
  applyBoxSizing,
  applyCornerRadii,
  applyFlexGap,
  applyPadding,
  applyPositioning,
  dashPatternFromCSS,
  fillsFromStyle,
  firstStrokeColor,
  setBorderWeights,
  setNodeBox,
  strokeWeightFromStyle
} from './box'
import { hasBoxStyle } from './boxes'
import { colorToStrokeFromCSS, mergedStyle, pickStyle } from './css-values'
import {
  applyContainerLayout,
  applyFlowSizing,
  elementDisplay,
  flowOf,
  inheritedTextStyle,
  type FlowKind,
  type ParentFlow
} from './flow'
import {
  applyCapturedLines,
  capturedBox,
  capturedTextBox,
  placeTopLevelLayers,
  type CapturedBox,
  type CapturedBoxes
} from './placement'
import {
  blockRichText,
  characterStyleFromCSS,
  elementLink,
  holdsTextBlocks,
  inlineRichText,
  isInlineContent,
  applyParagraphs,
  type CSSCharacterStyle
} from './text'

const DOM_CSS_PLUGIN_ID = 'open-pencil-dom-css'
const IMAGE_SOURCE_URL_KEY = 'image-source-url'

export interface DesignDocumentToSceneGraphOptions {
  pageName?: string
}

/**
 * CSS shadows as the layer's effects, each blurred as the browser blurs it: CSS blurs a shadow
 * by half its blur length, which the canvas draws from the radius that gives that sigma.
 */
function cssShadows(value: string | undefined): Effect[] {
  return parseCSSShadows(value).map((effect) => ({
    ...effect,
    radius: blurRadiusForSigma(effect.radius / 2)
  }))
}

function textContent(node: DesignNode): string {
  if (node.type === 'text') return node.text
  return node.children.map(textContent).join('')
}

function isTextLikeElement(node: DesignElement): boolean {
  return [
    'span',
    'p',
    'label',
    'strong',
    'em',
    'button',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6'
  ].includes(node.tagName.toLowerCase())
}

function imageScaleModeFromObjectFit(value: string | undefined): ImageScaleMode | null {
  if (value === 'contain' || value === 'scale-down') return 'FIT'
  if (value === 'cover') return 'FILL'
  return null
}

function bytesFromDataURL(value: string | undefined): Uint8Array | null {
  if (!value?.startsWith('data:')) return null
  const commaIndex = value.indexOf(',')
  if (commaIndex === -1) return null
  const metadata = value.slice(0, commaIndex)
  const body = value.slice(commaIndex + 1)
  // Invalid Base64 in imported HTML drops that image instead of the whole import.
  if (!metadata.endsWith(';base64') || !isValid(body)) return null
  return toUint8Array(body)
}

function applyImageFill(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  if (element.tagName.toLowerCase() !== 'img') return
  const source = element.attrs.src
  const bytes = bytesFromDataURL(source)
  if (!bytes) {
    if (source) {
      node.pluginData.push({
        pluginId: DOM_CSS_PLUGIN_ID,
        key: IMAGE_SOURCE_URL_KEY,
        value: source
      })
    }
    return
  }

  const imageHash = computeImageHash(bytes)
  graph.images.set(imageHash, bytes)
  node.fills = [
    {
      type: 'IMAGE',
      imageHash,
      imageScaleMode: imageScaleModeFromObjectFit(pickStyle(style, 'object-fit')) ?? 'FILL',
      color: TRANSPARENT,
      opacity: 1,
      visible: true
    }
  ]
}

function applyElementStyle(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  setNodeBox(node, style)
  applyBoxSizing(node, style)
  applyPositioning(node, style)
  applyPadding(node, style)

  const fills = fillsFromStyle(style, 'background-color')
  if (fills.length > 0) node.fills = fills
  applyImageFill(graph, node, element, style)

  const strokes = colorToStrokeFromCSS(
    firstStrokeColor(style),
    strokeWeightFromStyle(style)?.toString()
  )
  if (strokes.length > 0) {
    const dashPattern = dashPatternFromCSS(style, strokes[0].weight)
    if (dashPattern.length > 0) {
      strokes[0].dashPattern = dashPattern
      node.dashPattern = dashPattern
    }
    node.strokes = strokes
    setBorderWeights(node, style, strokes[0])
  }

  const effects = cssShadows(pickStyle(style, 'box-shadow'))
  if (effects.length > 0) node.effects = effects

  const opacity = parseCSSNumber(pickStyle(style, 'opacity'))
  if (opacity !== null) node.opacity = opacity

  applyCornerRadii(node, style)

  const overflow = pickStyle(style, 'overflow')
  if (overflow === 'hidden' || overflow === 'clip') node.clipsContent = true

  const alignSelf = parseCSSAlignSelf(pickStyle(style, 'align-self')) ?? 'AUTO'
  if (alignSelf !== 'AUTO') node.layoutAlignSelf = alignSelf
}

const CHARACTER_FIELDS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'italic',
  'letterSpacing',
  'lineHeight',
  'fills',
  'textDecoration',
  'textDecorationStyle',
  'textDecorationThickness',
  'textDecorationFills',
  'textDecorationSkipInk',
  'textUnderlineOffset',
  'textCase'
] as const satisfies readonly (keyof CSSCharacterStyle)[]

function applyTextStyle(node: SceneNode, style: DesignStyleDeclaration): void {
  setNodeBox(node, style)
  applyPositioning(node, style)
  Object.assign(node, characterStyleFromCSS(style, pick(node, CHARACTER_FIELDS)))

  const opacity = parseCSSNumber(pickStyle(style, 'opacity'))
  if (opacity !== null) node.opacity = opacity

  const effects = cssShadows(pickStyle(style, 'text-shadow'))
  if (effects.length > 0) node.effects = effects

  const textAlign = pickStyle(style, 'text-align')?.toUpperCase()
  if (textAlign === 'CENTER' || textAlign === 'RIGHT' || textAlign === 'JUSTIFIED') {
    node.textAlignHorizontal = textAlign
  }

  if (pickStyle(style, 'white-space') === 'nowrap') node.maxLines = 1
}

/**
 * Text and inline elements, or blocks of text, as one text layer: spans become runs, blocks
 * paragraphs, and lists list paragraphs, as Figma holds rich text.
 */
function createRichTextNode(
  graph: SceneGraph,
  parentId: string,
  element: DesignElement,
  style: DesignStyleDeclaration,
  display: string,
  parentFlow: ParentFlow
): SceneNode {
  const node = graph.createNode('TEXT', parentId, { name: 'Text' })
  applyTextStyle(node, style)
  const blocks = holdsTextBlocks(element, isPlainElement, isInlineElement)
  const base = pick(node, CHARACTER_FIELDS)
  const rich = blocks ? blockRichText(element, style, base) : inlineRichText(element, style, base)
  node.text = rich.text
  node.name = rich.text.slice(0, 32) || 'Text'
  node.styleRuns = rich.styleRuns
  if (blocks) applyParagraphs(node, rich)
  applyFlowSizing(graph, node, style, display, parentFlow)
  return node
}

/** Whether an element draws nothing of its own, so its text can join the text around it. */
function isPlainElement(element: DesignElement): boolean {
  return !hasBoxStyle(element, mergedStyle(element))
}

function isInlineElement(element: DesignElement): boolean {
  const style = mergedStyle(element)
  return elementDisplay(element, style) === 'inline' && !hasBoxStyle(element, style)
}

/** Whether the element's children are text in one layer: inline content, or text blocks. */
function holdsRichText(element: DesignElement): boolean {
  if (!element.children.some((child) => child.type === 'element')) return false
  if (holdsTextBlocks(element, isPlainElement, isInlineElement)) return true
  return isInlineContent(element, isInlineElement)
}

function createTextNode(
  graph: SceneGraph,
  parentId: string,
  text: string,
  style: DesignStyleDeclaration,
  display: string,
  parentFlow: ParentFlow
) {
  const node = graph.createNode('TEXT', parentId, { name: text.slice(0, 32) || 'Text', text })
  applyTextStyle(node, style)
  applyFlowSizing(graph, node, style, display, parentFlow)
  return node
}

/** A link of text alone links all of it. */
function linkText(node: SceneNode, element: DesignElement): void {
  const hyperlink = elementLink(element)
  if (hyperlink && node.text.length > 0) {
    node.styleRuns = [{ start: 0, length: node.text.length, style: { hyperlink } }]
  }
}

function hasContent(element: DesignElement): boolean {
  return element.children.some((child) => child.type !== 'text' || child.text.trim().length > 0)
}

/** Remembers where the layer's element was laid out, and how many lines its text took. */
function record(boxes: CapturedBoxes, node: SceneNode, captured: CapturedBox | undefined) {
  if (!captured) return
  boxes.set(node.id, captured)
  applyCapturedLines(node, captured)
}

function createElementNode(
  graph: SceneGraph,
  parentId: string,
  element: DesignElement,
  parentFlow: ParentFlow,
  boxes: CapturedBoxes
): SceneNode | null {
  const style = mergedStyle(element)
  const display = elementDisplay(element, style)
  if (display === 'none') return null
  if (
    isTextLikeElement(element) &&
    !hasBoxStyle(element, style) &&
    element.children.every((child) => child.type === 'text')
  ) {
    const text = createTextNode(graph, parentId, textContent(element), style, display, parentFlow)
    linkText(text, element)
    record(boxes, text, capturedBox(element))
    return text
  }
  if (!hasBoxStyle(element, style) && holdsRichText(element)) {
    const text = createRichTextNode(graph, parentId, element, style, display, parentFlow)
    record(boxes, text, capturedBox(element))
    return text
  }

  const node = graph.createNode('FRAME', parentId, {
    name: element.attrs.id || element.attrs.class || element.tagName,
    clipsContent: false
  })
  applyElementStyle(graph, node, element, style)
  record(boxes, node, capturedBox(element))
  // A box without content keeps its own size, as an image does, unless it declares a layout.
  const flow = hasContent(element) || flowOf(display) === 'flex' ? flowOf(display) : null
  if (flow) {
    applyContainerLayout(node, element, style, flow)
    if (flow === 'flex') applyFlexGap(node, style)
  }
  applyFlowSizing(graph, node, style, display, parentFlow)

  createChildLayers(graph, node, element, style, flow, boxes)
  return node
}

/**
 * A box's children as layers: blocks of text in its own flow as one text, since a flex box's
 * children are items, or each child as a layer of its own.
 */
function createChildLayers(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration,
  flow: FlowKind | null,
  boxes: CapturedBoxes
): void {
  if (flow !== 'flex' && holdsRichText(element)) {
    const textStyle = inheritedTextStyle(element, style)
    const textDisplay = flow === 'inline' ? 'inline' : 'block'
    const text = createRichTextNode(graph, node.id, element, textStyle, textDisplay, flow ?? 'none')
    record(boxes, text, capturedTextBox(element))
    return
  }
  // Text alone in a box takes the box its lines are in; text among elements has none of its own.
  const textBox = element.children.every((child) => child.type === 'text')
    ? capturedTextBox(element)
    : undefined
  for (const child of element.children) {
    const inherited = inheritedTextStyle(element, style)
    const layer = createDesignNode(graph, node.id, child, flow ?? 'none', boxes, inherited)
    if (layer?.type === 'TEXT') record(boxes, layer, textBox)
  }
}

function createDesignNode(
  graph: SceneGraph,
  parentId: string,
  node: DesignNode,
  parentFlow: ParentFlow,
  boxes: CapturedBoxes,
  inheritedStyle: DesignStyleDeclaration = {}
): SceneNode | null {
  if (node.type === 'text') {
    if (node.text.trim().length === 0) return null
    // Text runs in block flow and flex containers are blocks of their own, as CSS boxes them.
    const display = parentFlow === 'inline' ? 'inline' : 'block'
    return createTextNode(graph, parentId, node.text, inheritedStyle, display, parentFlow)
  }

  return createElementNode(graph, parentId, node, parentFlow, boxes)
}

function fitPageToChildren(page: SceneNode, graph: SceneGraph): void {
  const children = graph.getChildren(page.id)
  if (children.length === 0) return
  page.width = Math.max(...children.map((child) => child.x + child.width))
  page.height = Math.max(...children.map((child) => child.y + child.height))
}

/** Layers built from a styled document, with the boxes its layout was captured at. */
export interface DesignLayers {
  graph: SceneGraph
  /** Empty unless the document's layout was recorded; see `placeLayersFromLayout`. */
  boxes: CapturedBoxes
}

/**
 * The layers a styled document describes. Where its layout was recorded, top-level layers sit
 * at their captured boxes, and `boxes` lets the caller check auto layout against the rest once
 * it has laid the layers out.
 */
export function designDocumentToLayers(
  document: DesignDocument,
  options: DesignDocumentToSceneGraphOptions = {}
): DesignLayers {
  const graph = new SceneGraph()
  const page = graph.getPages().find((node) => node.type === 'CANVAS') ?? graph.addPage('DesignDOM')
  const boxes: CapturedBoxes = new Map()

  page.name = options.pageName ?? 'DesignDOM'

  for (const child of document.children) {
    createDesignNode(graph, page.id, child, 'none', boxes)
  }
  placeTopLevelLayers(graph, page.id, boxes)

  fitPageToChildren(page, graph)
  return { graph, boxes }
}

export function designDocumentToSceneGraph(
  document: DesignDocument,
  options: DesignDocumentToSceneGraphOptions = {}
): SceneGraph {
  return designDocumentToLayers(document, options).graph
}

export { placeLayersFromLayout, type CapturedBox, type CapturedBoxes } from './placement'

export type { DesignDocumentToSceneGraphOptions as ToSceneGraphOptions }
