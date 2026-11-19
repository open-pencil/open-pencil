import { pick } from 'es-toolkit'

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
import { maxOf } from '@open-pencil/std/arrays'

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
  hasBorder,
  strokeWeightFromStyle
} from './box'
import { hasBoxStyle } from './boxes'
import { colorToStrokeFromCSS, mergedStyle, pickStyle } from './css-values'
import {
  alignBlocksInFlow,
  type FlowBlock,
  alignBlockLines,
  applyContainerLayout,
  applyFlowSizing,
  elementDisplay,
  flowOf,
  inheritedTextStyle,
  isInlineLevel,
  textAlignOf,
  type FlowKind,
  type ParentFlow
} from './flow'
import { alignGridItems, isGrid } from './grid'
import { isSVGArtwork, imagePicture, maskSVG } from './pictures'
import {
  applyCapturedLines,
  capturedBox,
  capturedLinesBox,
  capturedTextBox,
  placeTopLevelLayers,
  type CapturedBox,
  type CapturedBoxes
} from './placement'
import { applySVGSize, isInlineSVG } from './svg'
import {
  applyCollapsedBorders,
  applyTableLayout,
  collapsesBorders,
  isTable,
  isTableColumn,
  isTableRow,
  layOutRowSpans,
  paintSharedBordersOnce,
  wrapTableGrid
} from './table'
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
import { cssTransform, type CSSTransforms } from './transform'

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

function applyImageFill(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
): void {
  if (element.tagName.toLowerCase() !== 'img') return
  const source = element.attrs.src
  const picture = imagePicture(element)
  // A picture nothing could draw keeps its address, which exporting the layer writes back.
  if (picture?.kind !== 'raster') {
    if (source) {
      node.pluginData.push({
        pluginId: DOM_CSS_PLUGIN_ID,
        key: IMAGE_SOURCE_URL_KEY,
        value: source
      })
    }
    return
  }

  const { bytes } = picture
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

  // A border without a style is not drawn and takes no room.
  const strokes = hasBorder(style)
    ? colorToStrokeFromCSS(firstStrokeColor(style), strokeWeightFromStyle(style)?.toString())
    : []
  if (strokes.length > 0) {
    const dashPattern = dashPatternFromCSS(style, strokes[0].weight)
    if (dashPattern.length > 0) {
      strokes[0].dashPattern = dashPattern
      node.dashPattern = dashPattern
    }
    node.strokes = strokes
    setBorderWeights(node, style, strokes[0])
    // A CSS border takes room inside the box, as an inside stroke included in layout does.
    node.strokesIncludedInLayout = true
  }

  const effects = cssShadows(pickStyle(style, 'box-shadow'))
  if (effects.length > 0) node.effects = effects

  const opacity = parseCSSNumber(pickStyle(style, 'opacity'))
  if (opacity !== null) node.opacity = opacity

  applyCornerRadii(node, style, element.layout?.box ?? node)

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

  const textAlign = textAlignOf(style)?.toUpperCase()
  if (textAlign === 'CENTER' || textAlign === 'RIGHT' || textAlign === 'JUSTIFIED') {
    node.textAlignHorizontal = textAlign
  }

  // Lays out as one line through its sizing; the line limit is for truncating it, as an
  // export writes it back as `nowrap`.
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

/** What building the layers records for laying them out: captured boxes and transforms. */
interface Recorded {
  boxes: CapturedBoxes
  transforms: CSSTransforms
  /**
   * Inline SVG, and images showing SVG, by the frame built for each, for the caller to draw once
   * laid out.
   */
  svgs: Map<string, DesignElement>
  /** Cells of tables with collapsed borders, until their table draws each shared border once. */
  collapsedCells: SceneNode[]
}

/** Remembers where the layer's element was laid out, and how many lines its text took. */
function record(
  graph: SceneGraph,
  recorded: Recorded,
  node: SceneNode,
  captured: CapturedBox | undefined
) {
  if (!captured) return
  recorded.boxes.set(node.id, captured)
  applyCapturedLines(graph, node, captured)
}

/** Remembers the element's box, and its transform, for the layer built for it. */
function recordElement(
  graph: SceneGraph,
  recorded: Recorded,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration
) {
  record(graph, recorded, node, capturedBox(element))
  const transform = cssTransform(style)
  if (transform) recorded.transforms.set(node.id, transform)
}

function createElementNode(
  graph: SceneGraph,
  parentId: string,
  element: DesignElement,
  parentFlow: ParentFlow,
  recorded: Recorded
): SceneNode | null {
  const style = mergedStyle(element)
  const display = elementDisplay(element, style)
  if (display === 'none' || isTableColumn(display)) return null
  if (isInlineSVG(element) || isSVGArtwork(element))
    return createSVGFrame(graph, parentId, element, parentFlow, recorded)
  if (
    isTextLikeElement(element) &&
    !hasBoxStyle(element, style, parentFlow) &&
    element.children.every((child) => child.type === 'text')
  ) {
    const text = createTextNode(graph, parentId, textContent(element), style, display, parentFlow)
    linkText(text, element)
    recordElement(graph, recorded, text, element, style)
    return text
  }
  if (!hasBoxStyle(element, style, parentFlow) && holdsRichText(element)) {
    const text = createRichTextNode(graph, parentId, element, style, display, parentFlow)
    recordElement(graph, recorded, text, element, style)
    return text
  }

  const node = graph.createNode('FRAME', parentId, {
    name: element.attrs.id || element.attrs.class || element.tagName,
    clipsContent: false
  })
  applyElementStyle(graph, node, element, style)
  applyCollapsedBorders(node, element, style, display)
  recordElement(graph, recorded, node, element, style)
  // A box without content keeps its own size, as an image does, unless it declares a layout.
  const flow = hasContent(element) || flowOf(display) === 'flex' ? flowOf(display) : null
  if (flow) {
    applyContainerLayout(node, element, style, flow)
    if (flow === 'flex') applyFlexGap(node, style)
    applyTableLayout(node, style, display)
  }
  applyFlowSizing(graph, node, style, display, parentFlow)

  if (display === 'table-cell' && collapsesBorders(style)) recorded.collapsedCells.push(node)
  const ownCells = recorded.collapsedCells.length
  const parts = createChildLayers(graph, node, element, style, flow, recorded, isGrid(display))
  layOutTablesAndGrids(graph, node, style, display, parts, recorded, ownCells)
  return node
}

/**
 * What tables and grids add once their children are layers: a table draws each collapsed border
 * once, its cells' from `cellsFrom` on, and boxes its captions; a row lays out cells that span
 * rows; a grid aligns its items.
 */
function layOutTablesAndGrids(
  graph: SceneGraph,
  node: SceneNode,
  style: DesignStyleDeclaration,
  display: string,
  parts: FlowBlock[],
  recorded: Recorded,
  cellsFrom: number
): void {
  if (isTable(display)) {
    const cells = recorded.collapsedCells.splice(cellsFrom)
    if (collapsesBorders(style)) paintSharedBordersOnce(cells, recorded.boxes)
    wrapTableGrid(graph, node, parts, recorded.boxes)
  }
  if (isTableRow(display)) layOutRowSpans(node, parts, recorded.boxes)
  if (isGrid(display)) alignGridItems(graph, node, parts, style, recorded.boxes)
}

/**
 * Inline SVG as a frame with the element's box and style and none of its shapes, recorded for
 * the caller to draw into once layout has sized it.
 */
function createSVGFrame(
  graph: SceneGraph,
  parentId: string,
  element: DesignElement,
  parentFlow: ParentFlow,
  recorded: Recorded
): SceneNode {
  const style = mergedStyle(element)
  const node = graph.createNode('FRAME', parentId, {
    name: element.attrs.id || element.attrs.class || element.tagName,
    clipsContent: false
  })
  applyElementStyle(graph, node, element, style)
  // A mask's background shows through its shapes only, which the artwork paints.
  if (maskSVG(element)) node.fills = []
  applySVGSize(node, element, style)
  recordElement(graph, recorded, node, element, style)
  recorded.svgs.set(node.id, element)
  applyFlowSizing(graph, node, style, elementDisplay(element, style), parentFlow)
  return node
}

/**
 * A box's children as layers: blocks of text in its own flow as one text, since a flex box's
 * children are items, or each child as a layer of its own. Returns the layers of its child
 * elements, with their styles.
 */
/** How many runs of text that show something an element holds among its children. */
function textRuns(element: DesignElement): number {
  return element.children.filter((child) => child.type === 'text' && child.text.trim() !== '')
    .length
}

/**
 * The box an element's own text was laid out in. Text alone in a box takes the box its lines are
 * in. Text among the items of a flex container or a grid is an item of its own, its lines the
 * container's only ones, as the items around it lay out as blocks; text among other elements has
 * no box of its own.
 */
function ownTextBox(element: DesignElement, holdsItems: boolean): CapturedBox | undefined {
  if (element.children.every((child) => child.type === 'text')) return capturedTextBox(element)
  return holdsItems && textRuns(element) === 1 ? capturedLinesBox(element) : undefined
}

function createChildLayers(
  graph: SceneGraph,
  node: SceneNode,
  element: DesignElement,
  style: DesignStyleDeclaration,
  flow: FlowKind | null,
  recorded: Recorded,
  grid = false
): FlowBlock[] {
  // A flex container's and a grid's children are items, each a layer its container aligns.
  if (flow !== 'flex' && !grid && holdsRichText(element)) {
    const textStyle = inheritedTextStyle(style)
    const textDisplay = flow === 'inline' ? 'inline' : 'block'
    const text = createRichTextNode(graph, node.id, element, textStyle, textDisplay, flow ?? 'none')
    record(graph, recorded, text, capturedTextBox(element))
    if (flow === 'block') alignBlockLines(graph, node, style, true)
    return []
  }
  const textBox = ownTextBox(element, flow === 'flex' || grid)
  // Whether everything the element holds sits in its lines, which its `text-align` aligns.
  let inlineContent = true
  const blocks: FlowBlock[] = []
  const parts: FlowBlock[] = []
  for (const child of element.children) {
    const inherited = inheritedTextStyle(style)
    const layer = createDesignNode(graph, node.id, child, flow ?? 'none', recorded, inherited)
    // Text the element holds directly sits in its lines; an element that became text has its own box.
    if (layer?.type === 'TEXT' && child.type === 'text') record(graph, recorded, layer, textBox)
    if (child.type !== 'element' || !layer) continue
    const childStyle = mergedStyle(child)
    parts.push({ layer, element: child, style: childStyle })
    // An absolutely positioned box is out of the flow, in no line and no block of its own.
    if (layer.layoutPositioning === 'ABSOLUTE') continue
    if (isInlineLevel(elementDisplay(child, childStyle))) continue
    inlineContent = false
    if (layer.type === 'FRAME') blocks.push({ layer, element: child, style: childStyle })
  }
  if (flow === 'block') {
    alignBlocksInFlow(graph, node, blocks, style)
    alignBlockLines(graph, node, style, inlineContent)
  }
  return parts
}

function createDesignNode(
  graph: SceneGraph,
  parentId: string,
  node: DesignNode,
  parentFlow: ParentFlow,
  recorded: Recorded,
  inheritedStyle: DesignStyleDeclaration = {}
): SceneNode | null {
  if (node.type === 'text') {
    if (node.text.trim().length === 0) return null
    // Text runs in block flow and flex containers are blocks of their own, as CSS boxes them.
    const display = parentFlow === 'inline' ? 'inline' : 'block'
    return createTextNode(graph, parentId, node.text, inheritedStyle, display, parentFlow)
  }

  return createElementNode(graph, parentId, node, parentFlow, recorded)
}

function fitPageToChildren(page: SceneNode, graph: SceneGraph): void {
  const children = graph.getChildren(page.id)
  if (children.length === 0) return
  page.width = maxOf(children.map((child) => child.x + child.width))
  page.height = maxOf(children.map((child) => child.y + child.height))
}

/** Layers built from a styled document, with the boxes its layout was captured at. */
export interface DesignLayers {
  graph: SceneGraph
  /** Empty unless the document's layout was recorded; see `placeLayersFromLayout`. */
  boxes: CapturedBoxes
  /** The elements' transforms, for `applyCSSTransforms` once the layers are laid out. */
  transforms: CSSTransforms
  /**
   * Inline SVG elements by the frame built for each. The frame takes the element's box and
   * style but none of its shapes, which the caller draws into it at the size layout gives it.
   */
  svgs: Map<string, DesignElement>
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
  const recorded: Recorded = {
    boxes: new Map(),
    transforms: new Map(),
    svgs: new Map(),
    collapsedCells: []
  }

  page.name = options.pageName ?? 'DesignDOM'

  for (const child of document.children) {
    createDesignNode(graph, page.id, child, 'none', recorded)
  }
  placeTopLevelLayers(graph, page.id, recorded.boxes)

  fitPageToChildren(page, graph)
  return { graph, ...recorded }
}

export function designDocumentToSceneGraph(
  document: DesignDocument,
  options: DesignDocumentToSceneGraphOptions = {}
): SceneGraph {
  return designDocumentToLayers(document, options).graph
}

export { elementSVG, imagePicture, type ElementSVG, type ImagePicture } from './pictures'
export { placeLayersFromLayout, type CapturedBox, type CapturedBoxes } from './placement'
export { applyCSSTransforms, type CSSTransform, type CSSTransforms } from './transform'

export type { DesignDocumentToSceneGraphOptions as ToSceneGraphOptions }
