import { DOMImplementation, XMLSerializer, type Document, type Element } from '@xmldom/xmldom'

import type { DrawIOCell, DrawIOFile, DrawIOGeometry, DrawIOPage, DrawIOPoint } from './model'
import { formatStyle } from './style'

/** What the writer puts on `<mxfile>`, so draw.io knows who wrote it. */
const HOST = 'OpenPencil'

function setNumber(element: Element, name: string, value: number) {
  if (value !== 0) element.setAttribute(name, String(value))
}

function point(document: Document, at: DrawIOPoint, as?: string): Element {
  const element = document.createElement('mxPoint')
  element.setAttribute('x', String(at.x))
  element.setAttribute('y', String(at.y))
  if (as) element.setAttribute('as', as)
  return element
}

function geometry(document: Document, value: DrawIOGeometry): Element {
  const element = document.createElement('mxGeometry')
  setNumber(element, 'x', value.x)
  setNumber(element, 'y', value.y)
  setNumber(element, 'width', value.width)
  setNumber(element, 'height', value.height)
  if (value.relative) element.setAttribute('relative', '1')
  element.setAttribute('as', 'geometry')
  if (value.sourcePoint) element.appendChild(point(document, value.sourcePoint, 'sourcePoint'))
  if (value.targetPoint) element.appendChild(point(document, value.targetPoint, 'targetPoint'))
  if (value.points.length > 0) {
    const points = document.createElement('Array')
    points.setAttribute('as', 'points')
    for (const at of value.points) points.appendChild(point(document, at))
    element.appendChild(points)
  }
  if (value.offset) element.appendChild(point(document, value.offset, 'offset'))
  return element
}

/** A cell as draw.io writes it, wrapped in a `UserObject` when it carries attributes. */
function cellElement(document: Document, cell: DrawIOCell): Element {
  const element = document.createElement('mxCell')
  const wrapped = Object.keys(cell.attributes).length > 0
  if (!wrapped) {
    element.setAttribute('id', cell.id)
    element.setAttribute('value', cell.value)
  }
  const style = formatStyle(cell.style)
  if (style) element.setAttribute('style', style)
  element.setAttribute(cell.kind, '1')
  if (!cell.visible) element.setAttribute('visible', '0')
  element.setAttribute('parent', cell.parent)
  if (cell.source) element.setAttribute('source', cell.source)
  if (cell.target) element.setAttribute('target', cell.target)
  element.appendChild(geometry(document, cell.geometry))
  if (!wrapped) return element
  const wrapper = document.createElement('UserObject')
  wrapper.setAttribute('label', cell.value)
  for (const [name, value] of Object.entries(cell.attributes)) wrapper.setAttribute(name, value)
  wrapper.setAttribute('id', cell.id)
  wrapper.appendChild(element)
  return wrapper
}

function pageElement(document: Document, page: DrawIOPage): Element {
  const diagram = document.createElement('diagram')
  diagram.setAttribute('id', page.id)
  diagram.setAttribute('name', page.name)
  const model = document.createElement('mxGraphModel')
  for (const [name, value] of Object.entries(page.attributes)) model.setAttribute(name, value)
  const root = document.createElement('root')
  const rootCell = document.createElement('mxCell')
  rootCell.setAttribute('id', page.rootId)
  root.appendChild(rootCell)
  for (const layer of page.layers) {
    const element = document.createElement('mxCell')
    element.setAttribute('id', layer.id)
    if (layer.name) element.setAttribute('value', layer.name)
    if (layer.locked) element.setAttribute('style', 'locked=1;')
    if (!layer.visible) element.setAttribute('visible', '0')
    element.setAttribute('parent', page.rootId)
    root.appendChild(element)
  }
  for (const cell of page.cells) root.appendChild(cellElement(document, cell))
  model.appendChild(root)
  diagram.appendChild(model)
  return diagram
}

/**
 * A draw.io file as XML draw.io opens: each page a `<diagram>` holding its model uncompressed,
 * as draw.io itself saves by default, so the file diffs and reads as text. A file with pages that
 * could not be read is refused, since writing it would drop them.
 */
export function writeDrawIOFile(file: DrawIOFile): string {
  if (file.unreadable.length > 0) {
    throw new Error(`Could not write the draw.io pages ${file.unreadable.join(', ')}`)
  }
  const document = new DOMImplementation().createDocument(null, 'mxfile', null)
  const root = document.documentElement
  if (!root) throw new Error('Could not create a draw.io document')
  root.setAttribute('host', HOST)
  for (const page of file.pages) root.appendChild(pageElement(document, page))
  return new XMLSerializer().serializeToString(document)
}
