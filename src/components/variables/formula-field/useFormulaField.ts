import {
  autocompletion,
  completionKeymap,
  completionStatus,
  acceptCompletion,
  closeCompletion
} from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  insertNewline,
  isolateHistory,
  redo,
  undo
} from '@codemirror/commands'
import { Annotation, EditorSelection, Prec } from '@codemirror/state'
import { EditorView, keymap, placeholder, tooltips } from '@codemirror/view'
import { getCurrentInstance, watch, type Ref, type ShallowRef } from 'vue'

import { shortcutCode } from '@/app/shell/keyboard/layout'
import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { formulaEditorTheme } from '@/theme/code/formula'

import type { ExpressionDialect, ReferenceCompletion } from './dialects/types'
import { formulaReferences, referencePills } from './references'
import { formulaButtonSpace, formulaResult, resultDecoration } from './result'
import { formulaSegments, type FormulaPill, type FormulaSelection } from './source'

interface FormulaFieldOptions {
  dialect: ExpressionDialect
  completions: () => readonly ReferenceCompletion[]
  label: () => string
  placeholder: () => string
  attributes: () => Record<string, string>
  resolve: (source: string) => FormulaPill | undefined
  /** What the value gives, or a plain number's unit, shown after its text. */
  result: () => string | undefined
  /** Whether buttons sit over the field's top right corner, which the first line keeps clear. */
  buttons: () => boolean
  onChange: () => void
  onEnter: () => void
  onCancel: () => void
  onSelection: (range: FormulaSelection) => void
}

const externalUpdate = Annotation.define<boolean>()

/**
 * The completion list lives in the surrounding dialog and keeps within it: the inspector scrolls
 * and would clip it, and a modal dialog takes no pointer events outside itself.
 */
function completionPlacement(host: HTMLElement | null) {
  const container = host?.closest<HTMLElement>('[role="dialog"]')
  if (!container) return tooltips({ position: 'fixed' })
  return tooltips({
    position: 'absolute',
    parent: container,
    tooltipSpace: () => container.getBoundingClientRect()
  })
}

/** CodeMirror owns document edits, atomic references, selection, composition and history. */
export function useFormulaField(
  host: Readonly<ShallowRef<HTMLDivElement | null>>,
  model: Ref<string>,
  options: FormulaFieldOptions
) {
  const appContext = getCurrentInstance()?.appContext ?? null
  const view = useCodeMirror(host, {
    doc: () => model.value,
    label: options.label,
    theme: formulaEditorTheme,
    extensions: [
      history(),
      options.dialect.language,
      autocompletion({ override: [options.dialect.complete(options.completions)], icons: false }),
      keymap.of([...completionKeymap, { key: 'Tab', run: acceptCompletion }]),
      referencePills,
      resultDecoration,
      EditorView.lineWrapping,
      keymap.of(defaultKeymap),
      Prec.highest(
        EditorView.domEventHandlers({
          keydown(event, editor) {
            if (event.isComposing) return false
            const code = shortcutCode(event)
            if ((event.metaKey || event.ctrlKey) && (code === 'KeyZ' || code === 'KeyY')) {
              event.preventDefault()
              event.stopPropagation()
              if (event.shiftKey || code === 'KeyY') redo(editor)
              else undo(editor)
              return true
            }
            // Line breaks are whitespace in both syntaxes, so long values can span lines.
            if (event.code === 'Enter' && event.shiftKey) {
              event.preventDefault()
              return insertNewline(editor)
            }
            if (event.code === 'Enter' || event.code === 'Escape') {
              event.preventDefault()
              event.stopPropagation()
              if (completionStatus(editor.state) === 'active') {
                if (event.code === 'Escape') closeCompletion(editor)
                else acceptCompletion(editor)
                return true
              }
              if (event.code === 'Enter') options.onEnter()
              else options.onCancel()
              return true
            }
            return false
          },
          blur(event, editor) {
            if (event.relatedTarget instanceof Node && editor.dom.contains(event.relatedTarget))
              return false
            options.onChange()
            return false
          }
        })
      ),
      EditorView.updateListener.of((update) => {
        if (
          update.docChanged &&
          !update.transactions.some((transaction) => transaction.annotation(externalUpdate))
        )
          model.value = update.state.doc.toString()
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          const { from, to } = update.state.selection.main
          options.onSelection({ start: from, end: to })
        }
      })
    ],
    reactive: [
      () => completionPlacement(host.value),
      () => EditorView.contentAttributes.of(options.attributes()),
      () => placeholder(options.placeholder()),
      () => formulaResult.of(options.result() ?? ''),
      () => formulaButtonSpace.of(options.buttons()),
      () =>
        formulaReferences.of({
          appContext,
          ranges: options.dialect.references,
          pills: new Map(
            formulaSegments(
              model.value,
              options.dialect.references(model.value),
              options.resolve
            ).flatMap(({ source, pill }) => (pill ? [[source, pill]] : []))
          )
        })
    ]
  })

  watch(model, (value) => {
    const editor = view.value
    if (!editor || editor.state.doc.toString() === value) return
    const { anchor, head } = editor.state.selection.main
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      selection: EditorSelection.single(
        Math.min(anchor, value.length),
        Math.min(head, value.length)
      ),
      annotations: [externalUpdate.of(true), isolateHistory.of('full')]
    })
    // Keep the explicit post-replacement range in CodeMirror's selection history for redo.
    editor.dispatch({ selection: editor.state.selection })
  })

  return {
    focus: () => view.value?.focus(),
    blur: () => view.value?.contentDOM.blur(),
    setSelectionRange: (start: number, end: number) => {
      const editor = view.value
      if (!editor) return
      editor.dispatch({ selection: EditorSelection.single(start, end) })
    }
  }
}
