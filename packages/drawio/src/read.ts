import type { Element } from '@xmldom/xmldom'
import { isValid, toUint8Array } from 'js-base64'

import { boundedInflate, inflateBudget, percentDecoded, type InflateBudget } from './inflate'
import type {
  DrawIOCell,
  DrawIOFile,
  DrawIOGeometry,
  DrawIOLayer,
  DrawIOPage,
  DrawIOPoint
} from './model'
import { parseStyle, styleFlag } from './style'
import { attributesOf, childElements, parseXML } from './xml'

/** What a cell wrapper keeps for itself rather than as the cell's attributes. */
const WRAPPER_OWN = new Set(['id', 'label'])

function number(element: Element, name: string, fallback = 0): number {
  const value = Number.parseFloat(element.getAttribute(name) ?? '')
  return Number.isFinite(value) ? value : fallback
}

function pointOf(element: Element): DrawIOPoint {
  return { x: number(element, 'x'), y: number(element, 'y') }
}

const NO_GEOMETRY: DrawIOGeometry = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  relative: false,
  points: [],
  sourcePoint: null,
  targetPoint: null,
  offset: null
}

function readGeometry(cell: Element): DrawIOGeometry {
  const geometry = childElements(cell, 'mxGeometry').at(0)
  if (!geometry) return structuredClone(NO_GEOMETRY)
  const points = childElements(geometry, 'Array').find((e) => e.getAttribute('as') === 'points')
  const point = (as: string) => {
    const found = childElements(geometry, 'mxPoint').find((p) => p.getAttribute('as') === as)
    return found ? pointOf(found) : null
  }
  return {
    x: number(geometry, 'x'),
    y: number(geometry, 'y'),
    width: number(geometry, 'width'),
    height: number(geometry, 'height'),
    relative: geometry.getAttribute('relative') === '1',
    points: points ? childElements(points, 'mxPoint').map(pointOf) : [],
    sourcePoint: point('sourcePoint'),
    targetPoint: point('targetPoint'),
    offset: point('offset')
  }
}

/** A cell element, and the `UserObject` or `object` around it when there is one. */
interface CellElements {
  cell: Element
  wrapper: Element | null
}

function cellElements(element: Element): CellElements | null {
  if (element.localName === 'mxCell') return { cell: element, wrapper: null }
  if (element.localName !== 'UserObject' && element.localName !== 'object') return null
  const cell = childElements(element, 'mxCell').at(0)
  return cell ? { cell, wrapper: element } : null
}

function readCell({ cell, wrapper }: CellElements, id: string, parent: string): DrawIOCell {
  const isEdge = cell.getAttribute('edge') === '1'
  return {
    id,
    parent,
    kind: isEdge ? 'edge' : 'vertex',
    value: (wrapper ? wrapper.getAttribute('label') : cell.getAttribute('value')) ?? '',
    style: parseStyle(cell.getAttribute('style') ?? ''),
    geometry: readGeometry(cell),
    visible: cell.getAttribute('visible') !== '0',
    source: cell.getAttribute('source'),
    target: cell.getAttribute('target'),
    attributes: wrapper ? attributesOf(wrapper, WRAPPER_OWN) : {}
  }
}

/**
 * A model's cells. Its root is the one cell without a parent, and its layers are the cells under
 * the root that are neither shapes nor edges; draw.io names them `0` and `1` by default.
 */
function readModel(model: Element, page: Pick<DrawIOPage, 'id' | 'name'>): DrawIOPage | null {
  const root = childElements(model, 'root').at(0)
  if (!root) return null
  const read: { elements: CellElements; id: string; parent: string | null }[] = []
  for (const element of childElements(root)) {
    const elements = cellElements(element)
    const id = (elements?.wrapper ?? elements?.cell)?.getAttribute('id')
    if (elements && id) read.push({ elements, id, parent: elements.cell.getAttribute('parent') })
  }
  const rootId = read.find((entry) => !entry.parent)?.id
  if (rootId === undefined) return null
  const layers: DrawIOLayer[] = []
  const cells: DrawIOCell[] = []
  for (const { elements, id, parent } of read) {
    if (!parent) continue
    const { cell } = elements
    const shown = cell.getAttribute('vertex') === '1' || cell.getAttribute('edge') === '1'
    if (!shown && parent === rootId) {
      layers.push({
        id,
        name: cell.getAttribute('value') ?? '',
        visible: cell.getAttribute('visible') !== '0',
        locked: styleFlag(parseStyle(cell.getAttribute('style') ?? ''), 'locked')
      })
    } else if (shown) {
      cells.push(readCell(elements, id, parent))
    }
  }
  return {
    ...page,
    attributes: attributesOf(model, new Set()),
    rootId,
    layers,
    cells
  }
}

/** The XML inside a compressed `<diagram>`: Base64, raw deflate, then percent-encoded text. */
function inflateDiagram(text: string, budget: InflateBudget): string | null {
  const encoded = text.trim()
  if (!encoded || !isValid(encoded)) return null
  try {
    return percentDecoded(new TextDecoder().decode(boundedInflate(toUint8Array(encoded), budget)))
  } catch {
    return null
  }
}

function readDiagram(
  diagram: Element,
  index: number,
  budget: InflateBudget
): DrawIOPage | { unreadable: string } {
  const name = diagram.getAttribute('name') || `Page ${index + 1}`
  const page = { id: diagram.getAttribute('id') ?? `page-${index + 1}`, name }
  let model = childElements(diagram, 'mxGraphModel').at(0) ?? null
  if (!model) {
    const xml = inflateDiagram(diagram.textContent ?? '', budget)
    const root = xml ? parseXML(xml) : null
    model = root?.localName === 'mxGraphModel' ? root : null
  }
  return (model ? readModel(model, page) : null) ?? { unreadable: name }
}

/**
 * The pages of a draw.io file, whether its diagrams are plain or compressed, with the names of
 * pages it could not read: damaged, or past what the file may unpack to. Null when the source
 * is not a draw.io file.
 */
export function parseDrawIOFile(source: string, budget = inflateBudget()): DrawIOFile | null {
  const root = parseXML(source)
  return root ? readDrawIORoot(root, budget) : null
}

/** The pages of a draw.io document from its parsed root, as `parseDrawIOFile` reads them. */
export function readDrawIORoot(root: Element, budget: InflateBudget): DrawIOFile | null {
  if (root.localName === 'mxGraphModel') {
    const page = readModel(root, { id: 'page-1', name: 'Page 1' })
    return page ? { pages: [page], unreadable: [] } : null
  }
  if (root.localName !== 'mxfile') return null
  const file: DrawIOFile = { pages: [], unreadable: [] }
  for (const [index, diagram] of childElements(root, 'diagram').entries()) {
    const read = readDiagram(diagram, index, budget)
    if ('unreadable' in read) file.unreadable.push(read.unreadable)
    else file.pages.push(read)
  }
  return file
}
