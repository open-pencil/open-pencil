import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  Facet,
  StateEffect,
  StateField,
  type ChangeDesc,
  type EditorState,
  type Extension
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'

import type { DesignJSXElement } from '@open-pencil/design-jsx'

import type { LayerLinkSource } from '@/app/code/layers/links'

import type { StaleAttribute } from './stale'

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
  /**
   * The layer as Design JSX wrote it when the code was last in sync with it; a canvas change
   * patches the code where the layer's description differs from this base.
   */
  base: DesignJSXElement | null
}

export interface LayerLinkConfig {
  /** Runtime type of a tag name, to tell elements on the same line apart. */
  typeOf?: (tagName: string) => string | undefined
  /** The layers of the element around the cursor while the editor has focus, else `null`. */
  onActive: (nodeIds: readonly string[] | null) => void
  /** The layer as Design JSX writes it now, or `null` when it cannot be patched. */
  describe?: (nodeId: string) => DesignJSXElement | null
  /** Explains code the canvas has changed since but could not patch. */
  staleMessage?: (stale: StaleAttribute) => string
}

type SyntaxNode = ReturnType<typeof syntaxTree>['topNode']

export const setLayerLinks = StateEffect.define<LayerLinkSource | null>()

/** The code now matches these layers as described: the new base of each. */
export const setLayerBases = StateEffect.define<ReadonlyMap<string, DesignJSXElement | null>>()

/** Links elements written into `from`..`to` of the new document to layers, in element order. */
export const linkInsertedElements = StateEffect.define<{
  from: number
  to: number
  layerIds: ReadonlyArray<string | null>
}>()

export const layerLinkConfig = Facet.define<LayerLinkConfig, LayerLinkConfig | null>({
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
function parseElements(state: EditorState, from = 0, to = state.doc.length): ParsedElement[] {
  const tree = ensureSyntaxTree(state, state.doc.length, 250) ?? syntaxTree(state)
  const elements: ParsedElement[] = []
  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.from < from || node.to > to) return
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

function linkByOrder(
  elements: ParsedElement[],
  layerIds: ReadonlyArray<string | null>
): LinkedElement[] {
  const linked: LinkedElement[] = []
  for (const [index, element] of elements.entries()) {
    const nodeId = layerIds[index]
    if (nodeId) linked.push({ ...element, nodeIds: [nodeId], base: null })
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
  return [...byElement].map(([element, nodeIds]): LinkedElement => ({
    ...element,
    nodeIds,
    base: null
  }))
}

/** Records what each layer looks like now, which is what the code was linked against. */
function withBases(state: EditorState, elements: LinkedElement[]): LinkedElement[] {
  const describe = state.facet(layerLinkConfig)?.describe
  if (!describe) return elements
  return elements.map((element) => ({ ...element, base: describe(element.nodeIds[0]) }))
}

function resolveLinks(state: EditorState, source: LayerLinkSource | null): LinkedElement[] {
  if (!source) return []
  const elements = parseElements(state)
  const linked =
    source.kind === 'order'
      ? linkByOrder(elements, source.layerIds)
      : linkByLines(elements, source.layers, state.facet(layerLinkConfig)?.typeOf)
  return withBases(state, linked)
}

function mapElement(element: LinkedElement, changes: ChangeDesc): LinkedElement | null {
  const from = changes.mapPos(element.from, 1)
  const to = changes.mapPos(element.to, -1)
  if (to <= from) return null
  return {
    ...element,
    from,
    to,
    openTo: changes.mapPos(element.openTo, -1),
    nameFrom: changes.mapPos(element.nameFrom, 1),
    nameTo: changes.mapPos(element.nameTo, -1),
    closeNameFrom: changes.mapPos(element.closeNameFrom, 1),
    closeNameTo: changes.mapPos(element.closeNameTo, -1)
  }
}

/** Linked elements, kept in place through edits until the next source replaces them. */
export const linkedElements = StateField.define<LinkedElement[]>({
  create: () => [],
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setLayerLinks)) return resolveLinks(transaction.state, effect.value)
    }
    let next = value
    if (transaction.docChanged) {
      next = next.flatMap((element) => mapElement(element, transaction.changes) ?? [])
    }
    for (const effect of transaction.effects) {
      if (effect.is(setLayerBases)) {
        const bases = effect.value
        next = next.map((element) => {
          const id = element.nodeIds[0]
          return bases.has(id) ? { ...element, base: bases.get(id) ?? null } : element
        })
      }
      if (effect.is(linkInsertedElements)) {
        const { from, to, layerIds } = effect.value
        const inserted = linkByOrder(parseElements(transaction.state, from, to), layerIds)
        next = [...next, ...withBases(transaction.state, inserted)].sort((a, b) => a.from - b.from)
      }
    }
    return next
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
