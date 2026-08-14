<script setup lang="ts">
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting
} from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { lintKeymap } from '@codemirror/lint'
import { searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers
} from '@codemirror/view'
import { onBeforeUnmount, onMounted, useTemplateRef, watch } from 'vue'

import { designJSXExtensions } from '@/components/code-editor/extensions'

const { modelValue } = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  apply: []
}>()

const host = useTemplateRef('host')
let editor: EditorView | undefined
let externalUpdate = false

onMounted(() => {
  const parent = host.value
  if (!parent) return
  editor = new EditorView({
    doc: modelValue,
    parent,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        ...lintKeymap
      ]),
      javascript({ jsx: true, typescript: true }),
      ...designJSXExtensions(),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--color-surface)' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
        '.cm-content': { padding: '12px 0', caretColor: 'var(--color-accent)' },
        '.cm-line': { padding: '0 12px' },
        '.cm-gutters': {
          backgroundColor: 'transparent',
          color: 'color-mix(in srgb, var(--color-muted) 45%, transparent)',
          border: 'none'
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor: 'color-mix(in srgb, var(--color-accent) 22%, transparent)'
        }
      }),
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            emit('apply')
            return true
          }
        }
      ]),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || externalUpdate) return
        emit('update:modelValue', update.state.doc.toString())
      })
    ]
  })
})

watch(
  () => modelValue,
  (value) => {
    if (!editor || editor.state.doc.toString() === value) return
    externalUpdate = true
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
    externalUpdate = false
  }
)

onBeforeUnmount(() => editor?.destroy())
</script>

<template>
  <div ref="host" data-slot="code-editor" class="min-h-0 flex-1 overflow-hidden text-xs" />
</template>
