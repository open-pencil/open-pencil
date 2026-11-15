<script setup lang="ts">
import { history, standardKeymap } from '@codemirror/commands'
import { StreamLanguage } from '@codemirror/language'
import { setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { EditorState, type Text } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  keymap,
  lineNumbers,
  placeholder as placeholderText
} from '@codemirror/view'
import { knapStreamParser } from 'knap/codemirror'
import { tv } from 'tailwind-variants'
import { useTemplateRef, watch } from 'vue'

import type { TemplateCheck, TemplateProblem } from '@/app/ai/prompts/engine'
import { appHistoryKeys } from '@/components/code-editor/history'
import { dialogTooltips } from '@/components/code-editor/tooltips'
import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { templateAssist } from '@/components/settings/prompts/template-assist'
import { codeEditorTheme, promptEditorTheme } from '@/theme/code/editor'
import promptEditorFieldTheme from '@/theme/settings/prompt-editor'

/**
 * A prompt to edit: a Knap template, highlighted with what is wrong with it underlined, or plain
 * Markdown. Long lines wrap, since prompts are prose.
 */
const {
  modelValue,
  label,
  template = false,
  check = null,
  variables = {},
  placeholder = '',
  unknownVariableMessage
} = defineProps<{
  modelValue: string
  label: string
  /** Whether the text is a Knap template, highlighted and checked as one. */
  template?: boolean
  check?: TemplateCheck | null
  /** A template's variables with their sample values, which completion and hovers show. */
  variables?: Readonly<Record<string, unknown>>
  /** What an empty editor shows. */
  placeholder?: string
  /** What an underlined variable the prompt does not offer says, given its name. */
  unknownVariableMessage?: (name: string) => string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const ui = tv(promptEditorFieldTheme)()

let externalUpdate = false

const host = useTemplateRef('host')
const view = useCodeMirror(host, {
  doc: () => modelValue,
  label: () => label,
  theme: (dark) => [codeEditorTheme(dark), promptEditorTheme],
  extensions: [
    placeholderText(placeholder),
    history(),
    drawSelection(),
    // Prose keys only: moving, selecting, and deleting, with undo and redo on the app's own
    // shortcuts. Code-editing keys, such as indenting with Mod-[ and Mod-], would take keys the
    // desktop menu uses for layers.
    appHistoryKeys(),
    keymap.of(standardKeymap),
    // A template's errors are reported by line, so its lines are numbered; instructions are prose.
    ...(template
      ? [lineNumbers(), StreamLanguage.define(knapStreamParser), templateAssist(variables)]
      : []),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !externalUpdate)
        emit('update:modelValue', update.state.doc.toString())
    })
  ],
  // Completion and hovers keep within Settings, which is a dialog.
  reactive: [() => dialogTooltips(host.value)]
})

// Text set from outside, as by Reset, replaces the document.
watch(
  () => modelValue,
  (value) => {
    const editor = view.value
    if (!editor || editor.state.doc.toString() === value) return
    externalUpdate = true
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    externalUpdate = false
  }
)

/** Where a problem a check reports starts in the document, kept inside it. */
function offset(doc: Text, { line, column }: TemplateProblem): number {
  const at = doc.line(Math.min(Math.max(line, 1), doc.lines))
  return Math.min(at.from + Math.max(column - 1, 0), at.to)
}

function diagnostics(state: EditorState, checked: TemplateCheck): Diagnostic[] {
  const mark = (
    problem: TemplateProblem,
    length: number,
    severity: Diagnostic['severity'],
    message: string
  ) => {
    const from = offset(state.doc, problem)
    return { from, to: Math.min(from + length, state.doc.length), severity, message }
  }
  return [
    ...checked.errors.map((problem) => mark(problem, 1, 'error', problem.message)),
    // An unknown variable is underlined whole; its problem's message is its name.
    ...checked.unknownVariables.map((problem) =>
      mark(
        problem,
        problem.message.length,
        'warning',
        unknownVariableMessage?.(problem.message) ?? problem.message
      )
    )
  ]
}

watch(
  [view, () => check],
  ([editor, checked]) => {
    if (!editor || !template) return
    editor.dispatch(setDiagnostics(editor.state, checked ? diagnostics(editor.state, checked) : []))
  },
  { immediate: true }
)
</script>

<template>
  <!-- Prompts are written left to right, as code is, in a mirrored interface too. -->
  <div ref="host" dir="ltr" :class="ui.root()" />
</template>
