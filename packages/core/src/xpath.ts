import type { SceneGraph, SceneNode } from './scene-graph'
import type { IDomFacade } from 'fontoxpath'

const NODE_TYPES = {
  ELEMENT_NODE: 1,
  ATTRIBUTE_NODE: 2,
  TEXT_NODE: 3,
  DOCUMENT_NODE: 9
}

const QUERYABLE_ATTRS = [
  'name',
  'width',
  'height',
  'x',
  'y',
  'visible',
  'opacity',
  'cornerRadius',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'textDirection',
  'layoutMode',
  'layoutDirection',
  'itemSpacing',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'strokeWeight',
  'rotation',
  'locked',
  'blendMode',
  'text',
  'lineHeight',
  'letterSpacing'
]

interface XPathDocument {
  nodeType: number
  nodeName: string
  documentElement: XPathNode | null
  _children?: XPathNode[]
}

interface XPathAttr {
  nodeType: number
  nodeName: string
  name: string
  localName: string
  namespaceURI: null
  prefix: null
  value: string
  ownerElement: XPathNode
}

interface XPathNode {
  nodeType: number
  nodeName: string
  localName: string
  namespaceURI: null
  prefix: null
  _sceneNode: SceneNode
  _attrs?: XPathAttr[]
  _parent?: XPathNode | XPathDocument | null
  _children?: XPathNode[]
}

function wrapNode(
  _graph: SceneGraph,
  node: SceneNode,
  parent?: XPathNode | XPathDocument | null
): XPathNode {
  const wrapped: XPathNode = {
    nodeType: NODE_TYPES.ELEMENT_NODE,
    nodeName: node.type,
    localName: node.type,
    namespaceURI: null,
    prefix: null,
    _sceneNode: node,
    _parent: parent
  }
  return wrapped
}

function createDocument(graph: SceneGraph, rootNode: SceneNode): XPathDocument {
  const doc: XPathDocument = {
    nodeType: NODE_TYPES.DOCUMENT_NODE,
    nodeName: '#document',
    documentElement: null
  }
  const root = wrapNode(graph, rootNode, doc)
  doc.documentElement = root
  doc._children = [root]
  return doc
}

function getAttrs(wrapped: XPathNode): XPathAttr[] {
  if (wrapped._attrs) return wrapped._attrs

  const node = wrapped._sceneNode
  const attrs: XPathAttr[] = []

  for (const attrName of QUERYABLE_ATTRS) {
    if (attrName in node) {
      const value = Reflect.get(node, attrName)
      if (value === undefined || value === null || typeof value === 'symbol') continue
      const stringValue =
        typeof value === 'object'
          ? JSON.stringify(value)
          : String(value as string | number | boolean)
      attrs.push({
        nodeType: NODE_TYPES.ATTRIBUTE_NODE,
        nodeName: attrName,
        name: attrName,
        localName: attrName,
        namespaceURI: null,
        prefix: null,
        value: stringValue,
        ownerElement: wrapped
      })
    }
  }

  wrapped._attrs = attrs
  return attrs
}

function getChildren(graph: SceneGraph, wrapped: XPathNode): XPathNode[] {
  if (wrapped._children) return wrapped._children

  const node = wrapped._sceneNode
  wrapped._children = node.childIds
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined)
    .map((child) => wrapNode(graph, child, wrapped))

  return wrapped._children
}

function isDocument(node: unknown): node is XPathDocument {
  return (node as XPathDocument).nodeType === NODE_TYPES.DOCUMENT_NODE
}

function siblingNode(
  graph: SceneGraph,
  node: XPathNode | XPathDocument,
  offset: -1 | 1
): XPathNode | null {
  if (isDocument(node)) return null
  const parent = node._parent
  if (!parent || isDocument(parent)) return null
  const siblings = getChildren(graph, parent)
  const index = siblings.indexOf(node)
  if (index === -1) return null
  return siblings[index + offset] ?? null
}

function createDomFacade(graph: SceneGraph) {
  return {
    getAllAttributes(node: XPathNode | XPathDocument): XPathAttr[] {
      if (isDocument(node)) return []
      return getAttrs(node)
    },

    getAttribute(node: XPathNode | XPathDocument, attributeName: string): string | null {
      if (isDocument(node)) return null
      const sceneNode = node._sceneNode
      if (attributeName in sceneNode) {
        const value = Reflect.get(sceneNode, attributeName)
        if (value === undefined || value === null || typeof value === 'symbol') return null
        return typeof value === 'object'
          ? JSON.stringify(value)
          : String(value as string | number | boolean)
      }
      return null
    },

    getChildNodes(node: XPathNode | XPathDocument): XPathNode[] {
      if (isDocument(node)) return node._children ?? []
      return getChildren(graph, node)
    },

    getData(node: XPathAttr): string {
      return node.value
    },

    getFirstChild(node: XPathNode | XPathDocument): XPathNode | null {
      if (isDocument(node)) return node.documentElement
      const children = getChildren(graph, node)
      return children[0] ?? null
    },

    getLastChild(node: XPathNode | XPathDocument): XPathNode | null {
      if (isDocument(node)) return node.documentElement
      const children = getChildren(graph, node)
      return children[children.length - 1] ?? null
    },

    getNextSibling(node: XPathNode | XPathDocument): XPathNode | null {
      return siblingNode(graph, node, 1)
    },

    getParentNode(node: XPathNode | XPathDocument): XPathNode | XPathDocument | null {
      if (isDocument(node)) return null
      return node._parent ?? null
    },

    getPreviousSibling(node: XPathNode | XPathDocument): XPathNode | null {
      return siblingNode(graph, node, -1)
    }
  }
}

export interface XPathQueryOptions {
  limit?: number
  page?: string
}

export async function queryByXPath(
  graph: SceneGraph,
  selector: string,
  options: XPathQueryOptions = {}
): Promise<SceneNode[]> {
  const { limit = 1000 } = options
  const pages = graph.getPages()
  const targetPages = options.page ? pages.filter((p) => p.name === options.page) : pages

  if (targetPages.length === 0) return []

  const { evaluateXPathToNodes } = await import('fontoxpath')
  const domFacade = createDomFacade(graph) as IDomFacade
  const results: SceneNode[] = []

  for (const page of targetPages) {
    const doc = createDocument(graph, page)
    const nodes = evaluateXPathToNodes(selector, doc, domFacade)

    for (const node of nodes) {
      if (results.length >= limit) break
      const sceneNode = (node as XPathNode)._sceneNode
      if (sceneNode.type !== 'CANVAS') {
        results.push(sceneNode)
      }
    }

    if (results.length >= limit) break
  }

  return results
}

/**
 * Build an XPath selector that uniquely identifies a node in its page.
 *
 * Strategy: walk from the node up to the page root, building path segments.
 * Each segment uses the node type as the element name. If the name is
 * unique among siblings of the same type, use `[@name='...']`.
 * Otherwise fall back to a positional predicate `[n]`.
 */
export function nodeToXPath(graph: SceneGraph, nodeId: string): string | null {
  const node = graph.getNode(nodeId)
  if (!node) return null

  const segments: string[] = []
  let current = node

  for (;;) {
    if (current.type === 'CANVAS') break
    const parentId: string | null = current.parentId
    const parent: SceneNode | undefined = parentId ? graph.getNode(parentId) : undefined

    segments.unshift(buildSegment(graph, current, parent))
    if (!parent || parent.type === 'CANVAS') break
    current = parent
  }

  return segments.length > 0 ? '//' + segments.join('/') : null
}

function buildSegment(graph: SceneGraph, node: SceneNode, parent: SceneNode | undefined): string {
  const tag = node.type
  const escaped = escapeXPathName(node.name)

  if (!parent) return `${tag}[@name=${escaped}]`

  const siblings = parent.childIds
    .map((id) => graph.getNode(id))
    .filter((n): n is SceneNode => n !== undefined && n.type === tag)

  const sameNameCount = siblings.filter((s) => s.name === node.name).length
  if (sameNameCount <= 1) return `${tag}[@name=${escaped}]`

  const index = siblings.findIndex((s) => s.id === node.id) + 1
  return `${tag}[${index}]`
}

function escapeXPathName(s: string): string {
  if (!s.includes("'")) return `'${s}'`
  if (!s.includes('"')) return `"${s}"`
  const parts = s.split("'").map((p) => `'${p}'`)
  return `concat(${parts.join(', "\'", ')})`
}

export async function matchByXPath(
  graph: SceneGraph,
  selector: string,
  node: SceneNode
): Promise<boolean> {
  const { evaluateXPathToBoolean } = await import('fontoxpath')
  const domFacade = createDomFacade(graph) as IDomFacade
  const wrapped = wrapNode(graph, node)
  try {
    return evaluateXPathToBoolean(`self::*[${selector}]`, wrapped, domFacade)
  } catch {
    return false
  }
}
