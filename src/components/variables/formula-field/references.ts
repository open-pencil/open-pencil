import { Facet, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { h, nextTick, render, type AppContext } from 'vue'

import BindingPill from '@/components/ui/binding/BindingPill.vue'

import type { ReferenceRange } from './dialects/types'
import { formulaSegments, type FormulaPill } from './source'

interface FormulaReferences {
  pills: ReadonlyMap<string, FormulaPill>
  /** Where the field's syntax spells finished references. */
  ranges: (source: string) => ReferenceRange[]
  /** The host app's context, so a pill rendered outside the component tree keeps its globals. */
  appContext: AppContext | null
}

export const formulaReferences = Facet.define<FormulaReferences>()

/**
 * A pill inside the line, sitting on the text like a word. It leaves room on its line for an
 * operator before it, so a long name truncates instead of parting from its operator.
 */
const PILL_UI = { pill: 'mx-px inline-flex max-w-[calc(100%-2.5rem)] flex-none align-middle' }

class ReferenceWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly pill: FormulaPill,
    readonly appContext: AppContext | null
  ) {
    super()
  }

  eq(other: ReferenceWidget) {
    return (
      this.source === other.source &&
      this.pill.label === other.pill.label &&
      this.pill.tooltip === other.pill.tooltip
    )
  }

  toDOM(view: EditorView) {
    const host = view.dom.ownerDocument.createElement('span')
    host.contentEditable = 'false'
    // A zero-width space lets a line break before the pill, even right after `(`.
    const pill = view.dom.ownerDocument.createElement('span')
    pill.dataset.reference = this.source
    host.append('\u200B', pill)
    // Vue rendering flushes watchers; defer it until CodeMirror finishes its transaction.
    void nextTick(() => {
      if (!host.isConnected) return
      const vnode = h(BindingPill, {
        label: this.pill.label,
        tooltip: this.pill.tooltip,
        ui: PILL_UI
      })
      vnode.appContext = this.appContext
      render(vnode, pill)
      view.requestMeasure()
    })
    return host
  }

  destroy(host: HTMLElement) {
    const pill = host.lastElementChild
    if (pill instanceof HTMLElement) void nextTick(() => render(null, pill))
  }
}

function pillDecorations(state: EditorState) {
  const references = state.facet(formulaReferences).at(0)
  const decorations = []
  const doc = state.doc.toString()
  const ranges = references?.ranges(doc) ?? []
  for (const { source, start, end, pill } of formulaSegments(doc, ranges, (reference) =>
    references?.pills.get(reference)
  )) {
    if (pill)
      decorations.push(
        Decoration.replace({
          widget: new ReferenceWidget(source, pill, references?.appContext ?? null)
        }).range(start, end)
      )
  }
  return Decoration.set(decorations)
}

/** References show as variable pills that the caret, Backspace and Delete treat as one unit. */
export const referencePills = StateField.define({
  create: pillDecorations,
  update: (value, transaction) =>
    transaction.docChanged || transaction.reconfigured ? pillDecorations(transaction.state) : value,
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field))
  ]
})
