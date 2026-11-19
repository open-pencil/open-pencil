import { Facet, StateField, type EditorState } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { h, nextTick, render, type AppContext } from 'vue'

import { findReferences, type ChatReference } from '@/app/ai/chat/references/link'
import ChatReferenceChip from '@/components/chat/reference/ChatReferenceChip.vue'

/** The host app's context, so a chip rendered outside the component tree keeps its globals. */
export const composerAppContext = Facet.define<AppContext | null, AppContext | null>({
  combine: (values) => values.at(0) ?? null
})

class ReferenceWidget extends WidgetType {
  constructor(
    readonly reference: ChatReference,
    readonly appContext: AppContext | null
  ) {
    super()
  }

  eq(other: ReferenceWidget) {
    return (
      this.reference.kind === other.reference.kind &&
      this.reference.id === other.reference.id &&
      this.reference.label === other.reference.label
    )
  }

  toDOM(view: EditorView) {
    const host = view.dom.ownerDocument.createElement('span')
    host.contentEditable = 'false'
    // Vue rendering flushes watchers; defer it until CodeMirror finishes its transaction.
    void nextTick(() => {
      if (!host.isConnected) return
      const vnode = h(ChatReferenceChip, { reference: this.reference, interactive: false })
      vnode.appContext = this.appContext
      render(vnode, host)
      view.requestMeasure()
    })
    return host
  }

  destroy(host: HTMLElement) {
    void nextTick(() => render(null, host))
  }
}

function chipDecorations(state: EditorState) {
  const appContext = state.facet(composerAppContext)
  return Decoration.set(
    findReferences(state.doc.toString()).map(({ reference, start, end }) =>
      Decoration.replace({ widget: new ReferenceWidget(reference, appContext) }).range(start, end)
    )
  )
}

/** Reference links show as chips that the caret, Backspace and Delete treat as one unit. */
export const referenceChips = StateField.define({
  create: chipDecorations,
  update: (value, transaction) =>
    transaction.docChanged || transaction.reconfigured ? chipDecorations(transaction.state) : value,
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field))
  ]
})
