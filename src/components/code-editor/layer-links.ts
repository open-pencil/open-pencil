import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import { Facet, StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'

/**
 * How the code in an editor relates to layers.
 *
 * Generated code emits one element per layer in pre-order, so `order` pairs elements with layer
 * ids by position. Authored code can create many layers from one element (components, `map`)
 * or none, so `lines` names the line and runtime type each rendered layer came from.
 */
export type LayerLinkSource =
  | { kind: 'order'; layerIds: ReadonlyArray<string | null> }
  | { kind: 'lines'; layers: ReadonlyArray<{ line: number; type: string; nodeId: string }> }

/** A JSX element in the document and the layers it produced. */
export interface LinkedElement {
  from: number
  to: number
  /** End of the opening tag, which is what hover highlights. */
  openTo: number
  nameFrom: number
  nameTo: number
  nodeIds: string[]
}

export interface LayerLinkConfig {
  /** Runtime type of a tag name, to tell elements on the same line apart. */
  typeOf?: (tagName: string) => string | undefined
  /** Modifier that turns hover into a link: ⌘ on macOS, Ctrl elsewhere. */
  isLinkModifier: (event: MouseEvent | KeyboardEvent) => boolean
  onHover: (nodeIds: readonly string[] | null) => void
  onReveal: (nodeIds: readonly string[]) => void
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
      elements.push({
        from: node.from,
        to: node.to,
        openTo: tag.to,
        nameFrom: name.from,
        nameTo: name.to,
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
          nameTo: changes.mapPos(element.nameTo, -1)
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

const hoverTheme = EditorView.baseTheme({
  '.cm-layer-hover': { backgroundColor: 'rgb(59 130 246 / 0.14)', borderRadius: '2px' },
  '.cm-layer-link': { textDecoration: 'underline', textUnderlineOffset: '2px' },
  '&.cm-layer-link-active .cm-content': { cursor: 'pointer' }
})

function hoverDecorations(element: LinkedElement | null, linkMode: boolean): DecorationSet {
  if (!element) return Decoration.none
  const ranges = [Decoration.mark({ class: 'cm-layer-hover' }).range(element.from, element.openTo)]
  if (linkMode) {
    ranges.push(Decoration.mark({ class: 'cm-layer-link' }).range(element.nameFrom, element.nameTo))
  }
  return Decoration.set(ranges, true)
}

const layerHover = ViewPlugin.fromClass(
  class {
    hovered: LinkedElement | null = null
    linkMode = false
    decorations: DecorationSet = Decoration.none
    readonly onKey = (event: KeyboardEvent) => {
      const config = this.config()
      if (!config || !this.hovered) return
      this.show(this.hovered, config.isLinkModifier(event))
      this.view.dispatch({})
    }

    constructor(readonly view: EditorView) {
      // The pointer can rest on code without focusing it, so modifiers are watched globally.
      window.addEventListener('keydown', this.onKey)
      window.addEventListener('keyup', this.onKey)
    }

    update(update: ViewUpdate) {
      const replaced = update.transactions.some((tr) => tr.effects.some((e) => e.is(setLayerLinks)))
      // The hovered element moved or its layers changed; forget it until the pointer moves.
      if (update.docChanged || replaced) this.show(null, false)
    }

    destroy() {
      window.removeEventListener('keydown', this.onKey)
      window.removeEventListener('keyup', this.onKey)
      if (this.hovered) this.config()?.onHover(null)
    }

    config() {
      return this.view.state.facet(layerLinkConfig)
    }

    /** Updates hover state and decorations; the caller redraws when outside an update. */
    show(element: LinkedElement | null, linkMode: boolean): boolean {
      const nextLinkMode = linkMode && element !== null
      const changed =
        element?.from !== this.hovered?.from ||
        element?.nodeIds.join(',') !== this.hovered?.nodeIds.join(',')
      if (!changed && nextLinkMode === this.linkMode) return false
      this.hovered = element
      this.linkMode = nextLinkMode
      if (changed) this.config()?.onHover(element?.nodeIds ?? null)
      this.view.dom.classList.toggle('cm-layer-link-active', nextLinkMode)
      this.decorations = hoverDecorations(element, nextLinkMode)
      return true
    }

    elementAtPointer(event: MouseEvent) {
      const pos = this.view.posAtCoords({ x: event.clientX, y: event.clientY }, false)
      return linkedElementAt(this.view.state, pos)
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      mousemove(event) {
        const config = this.config()
        if (!config) return
        if (this.show(this.elementAtPointer(event), config.isLinkModifier(event))) {
          this.view.dispatch({})
        }
      },
      mouseleave() {
        if (this.show(null, false)) this.view.dispatch({})
      },
      mousedown(event) {
        const config = this.config()
        if (!config || event.button !== 0 || !config.isLinkModifier(event)) return false
        const element = this.elementAtPointer(event)
        if (!element) return false
        event.preventDefault()
        config.onReveal(element.nodeIds)
        return true
      }
    }
  }
)

/** Links JSX elements to canvas layers: hover highlights a layer, ⌘/Ctrl-click reveals it. */
export function layerLinks(config: LayerLinkConfig): Extension {
  return [layerLinkConfig.of(config), linkedElements, layerHover, hoverTheme]
}
