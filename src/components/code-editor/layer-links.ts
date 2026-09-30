import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Facet, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'

import type { LayerLinkSource } from '@/app/code/layers/links'

/** A JSX element in the document and the layers it produced. */
export interface LinkedElement {
  from: number
  to: number
  /** End of the opening tag, where issues on the element's attributes are underlined. */
  openTo: number
  nameFrom: number
  nameTo: number
  /** The closing tag's name; an empty range for a self-closing element. */
  closeNameFrom: number
  closeNameTo: number
  nodeIds: string[]
}

export interface LayerLinkConfig {
  /** Runtime type of a tag name, to tell elements on the same line apart. */
  typeOf?: (tagName: string) => string | undefined
  /** The layers of the element around the cursor while the editor has focus, else `null`. */
  onActive: (nodeIds: readonly string[] | null) => void
}

type SyntaxNode = ReturnType<typeof syntaxTree>['topNode']

export const setLayerLinks = StateEffect.define<LayerLinkSource | null>()

const layerLinkConfig = Facet.define<LayerLinkConfig, LayerLinkConfig | null>({
  combine: (values) => values.at(-1) ?? null
})

const TAG_NAMES = new Set([
  'JSXIdentifier',
  'JSXBuiltin',
  'JSXMemberExpression',
  'JSXNamespacedName'
])

interface ParsedElement {
  from: number
  to: number
  openTo: number
  nameFrom: number
  nameTo: number
  closeNameFrom: number
  closeNameTo: number
  name: string
  line: number
}

function openingTag(element: SyntaxNode): SyntaxNode | null {
  return element.getChild('JSXOpenTag') ?? element.getChild('JSXSelfClosingTag')
}

function tagName(tag: SyntaxNode): SyntaxNode | null {
  for (let child = tag.firstChild; child; child = child.nextSibling) {
    if (TAG_NAMES.has(child.name)) return child
  }
  return null
}

/** JSX elements in pre-order, the order in which exporters write layers. */
function parseElements(state: EditorState): ParsedElement[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 250) ?? syntaxTree(state)
  const elements: ParsedElement[] = []
  tree.iterate({
    enter(node) {
      if (node.name !== 'JSXElement') return
      const tag = openingTag(node.node)
      const name = tag && tagName(tag)
      if (!tag || !name) return
      const closeTag = node.node.getChild('JSXCloseTag')
      const closeName = closeTag && tagName(closeTag)
      elements.push({
        from: node.from,
        to: node.to,
        openTo: tag.to,
        nameFrom: name.from,
        nameTo: name.to,
        closeNameFrom: closeName?.from ?? name.to,
        closeNameTo: closeName?.to ?? name.to,
        name: state.doc.sliceString(name.from, name.to),
        line: state.doc.lineAt(node.from).number
      })
    }
  })
  return elements
}

function linkByOrder(elements: ParsedElement[], layerIds: ReadonlyArray<string | null>) {
  const linked: LinkedElement[] = []
  for (const [index, element] of elements.entries()) {
    const nodeId = layerIds[index]
    if (nodeId) linked.push({ ...element, nodeIds: [nodeId] })
  }
  return linked
}

function linkByLines(
  elements: ParsedElement[],
  layers: ReadonlyArray<{ line: number; type: string; nodeId: string }>,
  typeOf: LayerLinkConfig['typeOf']
) {
  const byElement = new Map<ParsedElement, string[]>()
  for (const layer of layers) {
    const onLine = elements.filter((element) => element.line === layer.line)
    const element =
      onLine.find((candidate) => typeOf?.(candidate.name) === layer.type) ?? onLine.at(0)
    if (!element) continue
    const ids = byElement.get(element) ?? []
    ids.push(layer.nodeId)
    byElement.set(element, ids)
  }
  return [...byElement].map(([element, nodeIds]) => ({ ...element, nodeIds }))
}

function resolveLinks(state: EditorState, source: LayerLinkSource | null): LinkedElement[] {
  if (!source) return []
  const elements = parseElements(state)
  if (source.kind === 'order') return linkByOrder(elements, source.layerIds)
  return linkByLines(elements, source.layers, state.facet(layerLinkConfig)?.typeOf)
}

/** Linked elements, kept in place through edits until the next source replaces them. */
export const linkedElements = StateField.define<LinkedElement[]>({
  create: () => [],
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setLayerLinks)) return resolveLinks(transaction.state, effect.value)
    }
    if (!transaction.docChanged) return value
    const { changes } = transaction
    return value.flatMap((element) => {
      const from = changes.mapPos(element.from, 1)
      const to = changes.mapPos(element.to, -1)
      if (to <= from) return []
      return [
        {
          ...element,
          from,
          to,
          openTo: changes.mapPos(element.openTo, -1),
          nameFrom: changes.mapPos(element.nameFrom, 1),
          nameTo: changes.mapPos(element.nameTo, -1),
          closeNameFrom: changes.mapPos(element.closeNameFrom, 1),
          closeNameTo: changes.mapPos(element.closeNameTo, -1)
        }
      ]
    })
  }
})

/** The innermost linked element around a document position. */
export function linkedElementAt(state: EditorState, pos: number): LinkedElement | null {
  let best: LinkedElement | null = null
  for (const element of state.field(linkedElements)) {
    if (pos < element.from || pos >= element.to) continue
    if (!best || element.to - element.from < best.to - best.from) best = element
  }
  return best
}

const activeTheme = EditorView.baseTheme({
  '.cm-layer-tag': { backgroundColor: 'rgb(59 130 246 / 0.22)', borderRadius: '2px' }
})

/** Marks the tag names of the element, opening and closing, like an editor's matching tag. */
function tagDecorations(element: LinkedElement | null): DecorationSet {
  if (!element) return Decoration.none
  const mark = Decoration.mark({ class: 'cm-layer-tag' })
  const ranges = [mark.range(element.nameFrom, element.nameTo)]
  if (element.closeNameTo > element.closeNameFrom) {
    ranges.push(mark.range(element.closeNameFrom, element.closeNameTo))
  }
  return Decoration.set(ranges)
}

function sameElement(a: LinkedElement | null, b: LinkedElement | null): boolean {
  return a?.from === b?.from && a?.nodeIds.join(',') === b?.nodeIds.join(',')
}

/** Follows the cursor: the element it is in while the editor has focus is the active one. */
const activeElement = ViewPlugin.fromClass(
  class {
    active: LinkedElement | null = null
    decorations: DecorationSet = Decoration.none

    constructor(readonly view: EditorView) {
      this.refresh()
    }

    update(update: ViewUpdate) {
      const replaced = update.transactions.some((tr) => tr.effects.some((e) => e.is(setLayerLinks)))
      if (update.docChanged || update.selectionSet || update.focusChanged || replaced) {
        this.refresh()
      }
    }

    destroy() {
      if (this.active) this.view.state.facet(layerLinkConfig)?.onActive(null)
    }

    refresh() {
      const { state } = this.view
      const element = this.view.hasFocus ? linkedElementAt(state, state.selection.main.head) : null
      const changed = !sameElement(element, this.active)
      this.active = element
      this.decorations = tagDecorations(element)
      if (changed) state.facet(layerLinkConfig)?.onActive(element?.nodeIds ?? null)
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

/** Links JSX elements to canvas layers: the element around the cursor marks its layer. */
export function layerLinks(config: LayerLinkConfig): Extension {
  return [layerLinkConfig.of(config), linkedElements, activeElement, activeTheme]
}
