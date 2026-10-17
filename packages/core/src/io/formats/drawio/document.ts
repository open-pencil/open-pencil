import { DOMParser, type Element } from '@xmldom/xmldom'
import { Inflate } from 'fflate'
import { isValid, toUint8Array } from 'js-base64'

import type { Vector } from '@open-pencil/scene-graph'

import { parseStyle, type DrawioStyle } from './style'

export interface DrawioGeometry {
  x: number
  y: number
  width: number
  height: number
  /** Waypoints of an edge, in the coordinates of its parent. */
  points: Vector[]
  /** Where an edge starts when it is not attached to a source shape. */
  sourcePoint: Vector | null
  /** Where an edge ends when it is not attached to a target shape. */
  targetPoint: Vector | null
}

export interface DrawioCell {
  id: string
  parent: string | null
  kind: 'vertex' | 'edge'
  /** The label: HTML when the style says `html=1`, plain text otherwise. */
  value: string
  style: DrawioStyle
  geometry: DrawioGeometry
  source: string | null
  target: string | null
  /** Attributes of the wrapping `UserObject` or `object`, such as `tooltip` and `link`. */
  meta: Record<string, string>
}

export interface DrawioPage {
  id: string
  name: string
  cells: DrawioCell[]
}

/** The ids draw.io gives its two root cells: the root itself and the default layer. */
const ROOT_IDS = new Set(['0', '1'])

export function parseXML(source: string): Element | null {
  try {
    const parsed = new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message)
      }
    }).parseFromString(source, 'text/xml')
    return parsed.documentElement
  } catch {
    return null
  }
}

function childElements(element: Element, name?: string): Element[] {
  const found: Element[] = []
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && (!name || (node as Element).localName === name)) {
      found.push(node as Element)
    }
  }
  return found
}

/** Largest unpacked diagram accepted, so a small crafted file cannot exhaust memory. */
const MAX_INFLATED_DIAGRAM_BYTES = 32 * 1024 * 1024
/** Input fed per step; deflate expands at most ~1032x, which keeps each step's output small. */
const INFLATE_STEP_BYTES = 4096

/** Raw deflate with an output cap; throws once the unpacked size would exceed it. */
export function boundedInflate(data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  let size = 0
  const inflater = new Inflate((chunk) => {
    size += chunk.length
    if (size > MAX_INFLATED_DIAGRAM_BYTES) throw new RangeError('draw.io diagram is too large')
    chunks.push(chunk)
  })
  for (let start = 0; start < data.length; start += INFLATE_STEP_BYTES) {
    const end = start + INFLATE_STEP_BYTES
    inflater.push(data.subarray(start, end), end >= data.length)
  }
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.length
  }
  return output
}

/** The XML inside a compressed `<diagram>`: Base64, raw deflate, then percent-encoded text. */
function inflateDiagram(text: string): string | null {
  const encoded = text.trim()
  if (!encoded || !isValid(encoded)) return null
  try {
    const inflated = new TextDecoder().decode(boundedInflate(toUint8Array(encoded)))
    return percentDecoded(inflated)
  } catch {
    return null
  }
}

/** A `%` that does not start an escape, as in "50% done". */
const STRAY_PERCENT = /%(?![0-9A-Fa-f]{2})/g
/** A run of escapes, decoded together so a character spread over several bytes stays whole. */
const ESCAPE_RUN = /(?:%[0-9A-Fa-f]{2})+/g

/**
 * The text with its percent escapes decoded. A stray `%` is kept as it is, and an escape run that
 * is not valid UTF-8 stays encoded, so neither stops the rest of the text from decoding.
 */
export function percentDecoded(text: string): string {
  const escaped = text.replace(STRAY_PERCENT, '%25')
  try {
    return decodeURIComponent(escaped)
  } catch {
    return escaped.replace(ESCAPE_RUN, (run) => {
      try {
        return decodeURIComponent(run)
      } catch {
        return run
      }
    })
  }
}

function number(element: Element, name: string, fallback = 0): number {
  const value = Number.parseFloat(element.getAttribute(name) ?? '')
  return Number.isFinite(value) ? value : fallback
}

function readGeometry(cell: Element): DrawioGeometry {
  const geometry = childElements(cell, 'mxGeometry').at(0)
  if (!geometry) {
    return { x: 0, y: 0, width: 0, height: 0, points: [], sourcePoint: null, targetPoint: null }
  }
  const array = childElements(geometry, 'Array').find((e) => e.getAttribute('as') === 'points')
  const point = (as: string): Vector | null => {
    const found = childElements(geometry, 'mxPoint').find((p) => p.getAttribute('as') === as)
    return found ? { x: number(found, 'x'), y: number(found, 'y') } : null
  }
  return {
    x: number(geometry, 'x'),
    y: number(geometry, 'y'),
    width: number(geometry, 'width'),
    height: number(geometry, 'height'),
    points: array
      ? childElements(array, 'mxPoint').map((p) => ({ x: number(p, 'x'), y: number(p, 'y') }))
      : [],
    sourcePoint: point('sourcePoint'),
    targetPoint: point('targetPoint')
  }
}

function readCell(element: Element): DrawioCell | null {
  const wrapped = element.localName === 'UserObject' || element.localName === 'object'
  const cell = wrapped ? childElements(element, 'mxCell').at(0) : element
  if (!cell) return null
  const id = element.getAttribute('id')
  if (!id) return null
  const meta: Record<string, string> = {}
  if (wrapped) {
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.name !== 'id' && attribute.name !== 'label')
        meta[attribute.name] = attribute.value
    }
  }
  const style = parseStyle(cell.getAttribute('style') ?? '')
  const isEdge = cell.getAttribute('edge') === '1'
  if (!isEdge && cell.getAttribute('vertex') !== '1') return null
  return {
    id,
    parent: cell.getAttribute('parent'),
    kind: isEdge ? 'edge' : 'vertex',
    value: (wrapped ? element.getAttribute('label') : cell.getAttribute('value')) ?? '',
    style,
    geometry: readGeometry(cell),
    source: cell.getAttribute('source'),
    target: cell.getAttribute('target'),
    meta
  }
}

function readModel(model: Element): DrawioCell[] {
  const root = childElements(model, 'root').at(0)
  if (!root) return []
  const cells: DrawioCell[] = []
  for (const element of childElements(root)) {
    const cell = readCell(element)
    if (cell && !ROOT_IDS.has(cell.id)) cells.push(cell)
  }
  return cells
}

/** A draw.io file's pages, and the names of those that could not be read. */
export interface DrawioFile {
  pages: DrawioPage[]
  unreadable: string[]
}

function readDiagram(diagram: Element, index: number): DrawioPage | { unreadable: string } {
  const name = diagram.getAttribute('name') || `Page ${index + 1}`
  let model = childElements(diagram, 'mxGraphModel').at(0) ?? null
  if (!model) {
    const xml = inflateDiagram(diagram.textContent ?? '')
    const root = xml ? parseXML(xml) : null
    model = root?.localName === 'mxGraphModel' ? root : null
  }
  if (!model) return { unreadable: name }
  return { id: diagram.getAttribute('id') ?? `page-${index + 1}`, name, cells: readModel(model) }
}

/**
 * The pages of a draw.io file, whether its diagrams are plain or compressed, with the names of
 * pages it could not read (damaged, or larger than the size limit once unpacked). Null when the
 * source is not a draw.io file.
 */
export function parseDrawioFile(source: string): DrawioFile | null {
  const root = parseXML(source)
  if (!root) return null
  if (root.localName === 'mxGraphModel') {
    return { pages: [{ id: 'page-1', name: 'Page 1', cells: readModel(root) }], unreadable: [] }
  }
  if (root.localName !== 'mxfile') return null
  const file: DrawioFile = { pages: [], unreadable: [] }
  for (const [index, diagram] of childElements(root, 'diagram').entries()) {
    const read = readDiagram(diagram, index)
    if ('unreadable' in read) file.unreadable.push(read.unreadable)
    else file.pages.push(read)
  }
  return file
}
