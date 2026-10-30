import {
  acceptCompletion,
  autocompletion,
  completionKeymap,
  completionStatus,
  type Completion,
  type CompletionSource
} from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands'
import { EditorSelection, EditorState, Prec } from '@codemirror/state'
import { drawSelection, EditorView, keymap, placeholder, tooltips } from '@codemirror/view'
import { getCurrentInstance, h, render, shallowRef, type Component, type ShallowRef } from 'vue'

import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { chatComposerTheme } from '@/theme/chat/composer'

import { isComposerCompletion } from './complete'
import { composerAppContext, referenceChips } from './references'

/**
 * Each row's glyph, as the layers panel draws it. The icons are static SVG, so each is rendered
 * once and copied into rows: a row has no teardown to unmount a component from.
 */
const renderedIcons = new WeakMap<Component, Element>()
function renderCompletionIcon(completion: Completion): Node | null {
  if (!isComposerCompletion(completion)) return null
  let icon = renderedIcons.get(completion.icon)
  if (!icon) {
    const host = document.createElement('span')
    host.className = 'cm-composer-icon'
    render(h(completion.icon, { 'aria-hidden': 'true' }), host)
    icon = host
    renderedIcons.set(completion.icon, icon)
  }
  return icon.cloneNode(true)
}

interface ChatEditorOptions {
  /** The text the field opens with. */
  initial?: string
  label: () => string
  placeholder: () => string
  editable: () => boolean
  /** Attributes for the editable element, such as its test ID. */
  attributes: Record<string, string>
  completions: CompletionSource[]
  /** Enter sends, or Alt+Enter, which while the agent works waits until it has finished. */
  onSubmit: (afterWork: boolean) => void
  /** Escape, when no completion is open; leaves Escape to the window otherwise. */
  onCancel?: () => boolean
  /**
   * Up on the first line: text taken back from somewhere, such as messages waiting to be sent,
   * to put ahead of what is typed; null leaves Up to move the caret.
   */
  onTakeBack?: () => string | null
}

/**
 * The chat's message field: CodeMirror owns typing, composition, history, and completions,
 * and references in the text show as chips that edit as one unit. Enter sends unless a
 * completion is open, and Shift+Enter starts a new line.
 */
export function useChatEditor(
  host: Readonly<ShallowRef<HTMLDivElement | null>>,
  options: ChatEditorOptions
) {
  const text = shallowRef(options.initial ?? '')
  const appContext = getCurrentInstance()?.appContext ?? null
  const view = useCodeMirror(host, {
    doc: () => text.value,
    label: options.label,
    theme: chatComposerTheme,
    extensions: [
      // A drawn caret is one line tall beside a placeholder that wraps; the native one spans it.
      drawSelection(),
      history(),
      composerAppContext.of(appContext),
      referenceChips,
      autocompletion({
        override: options.completions,
        icons: false,
        activateOnTyping: true,
        addToOptions: [{ render: renderCompletionIcon, position: 20 }]
      }),
      // The list opens above the field and may be wider than the panel, which clips its content.
      tooltips({ parent: document.body }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of(options.attributes),
      Prec.highest(
        keymap.of([
          {
            key: 'Enter',
            run: (editor) => {
              if (completionStatus(editor.state) === 'active') return acceptCompletion(editor)
              options.onSubmit(false)
              return true
            }
          },
          {
            key: 'Alt-Enter',
            run: () => {
              options.onSubmit(true)
              return true
            }
          },
          { key: 'Shift-Enter', run: insertNewline },
          {
            key: 'ArrowUp',
            run: (editor) => {
              const { head } = editor.state.selection.main
              if (completionStatus(editor.state) === 'active') return false
              if (editor.state.doc.lineAt(head).number !== 1) return false
              const taken = options.onTakeBack?.()
              if (!taken) return false
              const current = editor.state.doc.toString()
              setText(current.trim() ? `${taken}\n${current}` : taken)
              return true
            }
          },
          {
            key: 'Escape',
            run: (editor) => {
              if (completionStatus(editor.state) === 'active') return false
              return options.onCancel?.() ?? false
            }
          }
        ])
      ),
      keymap.of([...completionKeymap, ...historyKeymap, ...defaultKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) text.value = update.state.doc.toString()
      })
    ],
    reactive: [
      () => placeholder(options.placeholder()),
      // Read-only rather than not editable: the field stays focusable and reports itself
      // disabled, as the textarea it replaced did, until the chat is ready again.
      () => EditorState.readOnly.of(!options.editable()),
      () => EditorView.contentAttributes.of(options.editable() ? {} : { 'aria-disabled': 'true' })
    ]
  })

  /** Replaces the whole message, leaving the caret at its end. */
  function setText(value: string) {
    const editor = view.value
    text.value = value
    if (!editor) return
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      selection: EditorSelection.cursor(value.length)
    })
  }

  /** Inserts text at the caret, such as references to the selected layers. */
  function insert(value: string) {
    const editor = view.value
    if (!editor) return
    editor.dispatch(editor.state.replaceSelection(value))
    editor.focus()
  }

  /** Focuses the field with the caret at the end of the message. */
  function focusEnd() {
    const editor = view.value
    if (!editor) return
    editor.dispatch({ selection: EditorSelection.cursor(editor.state.doc.length) })
    editor.focus()
  }

  return { text, setText, insert, focus: () => view.value?.focus(), focusEnd }
}
