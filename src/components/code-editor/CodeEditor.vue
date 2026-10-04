<script setup lang="ts">
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, redo, undo } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { bracketMatching, foldGutter, foldKeymap, indentOnInput } from '@codemirror/language'
import { lintKeymap } from '@codemirror/lint'
import { searchKeymap } from '@codemirror/search'
import { EditorState, Transaction, type Extension } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { useTemplateRef, watch } from 'vue'

import { designJSXExtensions } from '@/components/code-editor/extensions'
import type { CodeEditorLanguage } from '@/components/code-editor/types'
import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { codeEditorTheme } from '@/theme/code/editor'

const {
  modelValue,
  language = 'design-jsx',
  readOnly = false,
  label = 'Code'
} = defineProps<{
  modelValue: string
  language?: CodeEditorLanguage
  readOnly?: boolean
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

let externalUpdate = false

function languageExtensions(language: CodeEditorLanguage): Extension {
  if (language === 'html-css') return html()
  return [
    javascript({ jsx: true, typescript: true }),
    ...(language === 'design-jsx' ? designJSXExtensions() : [])
  ]
}

function editableExtensions(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]
}

const view = useCodeMirror(useTemplateRef('host'), {
  doc: () => modelValue,
  label: () => label,
  theme: codeEditorTheme,
  extensions: [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    keymap.of([
      { key: 'Ctrl-z', run: undo },
      { key: 'Ctrl-Shift-z', run: redo },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      ...lintKeymap
    ]),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || externalUpdate) return
      emit('update:modelValue', update.state.doc.toString())
    })
  ],
  reactive: [() => languageExtensions(language), () => editableExtensions(readOnly)]
})

watch(
  () => modelValue,
  (value) => {
    const editor = view.value
    if (!editor || editor.state.doc.toString() === value) return
    externalUpdate = true
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
      annotations: Transaction.addToHistory.of(false)
    })
    externalUpdate = false
  }
)
</script>

<template>
  <div
    ref="host"
    data-slot="code-editor"
    class="min-h-0 flex-1 overflow-hidden text-xs [&_.cm-scroller]:scrollbar-thin"
  />
</template>
