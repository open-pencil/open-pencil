<script setup lang="ts">
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { foldGutter } from '@codemirror/language'
import { unifiedMergeView } from '@codemirror/merge'
import { search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, highlightSpecialChars, keymap } from '@codemirror/view'
import { useTemplateRef, watch } from 'vue'

import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { codeEditorTheme, codeViewerTheme } from '@/theme/code/editor'

export type CodeViewerLanguage = 'json' | 'design-jsx' | 'javascript'

const { code, language, label, original } = defineProps<{
  code: string
  language: CodeViewerLanguage
  label: string
  /** Shows `code` as a unified diff against this text. Read at mount. */
  original?: string
}>()

function languageExtension(language: CodeViewerLanguage): Extension {
  return language === 'json' ? json() : javascript({ jsx: true, typescript: true })
}

const view = useCodeMirror(useTemplateRef('host'), {
  doc: () => code,
  label: () => label,
  theme: (dark) => [codeEditorTheme(dark), codeViewerTheme],
  extensions: [
    EditorState.readOnly.of(true),
    highlightSpecialChars(),
    foldGutter(),
    search({ top: true }),
    keymap.of(searchKeymap),
    EditorView.lineWrapping,
    original === undefined
      ? []
      : unifiedMergeView({ original, mergeControls: false, collapseUnchanged: {} })
  ],
  reactive: [() => languageExtension(language)]
})

// Streamed tool input only grows; append when possible so folds and scroll survive.
watch(
  () => code,
  (next) => {
    const editor = view.value
    if (!editor) return
    const current = editor.state.doc.toString()
    if (current === next) return
    editor.dispatch(
      next.startsWith(current)
        ? { changes: { from: current.length, insert: next.slice(current.length) } }
        : { changes: { from: 0, to: current.length, insert: next } }
    )
  }
)
</script>

<template>
  <div
    ref="host"
    data-slot="code-viewer"
    class="max-h-64 overflow-hidden rounded border border-border [&_.cm-scroller]:scrollbar-thin"
  />
</template>
