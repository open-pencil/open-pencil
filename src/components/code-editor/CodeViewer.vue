<script setup lang="ts">
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { foldGutter } from '@codemirror/language'
import { unifiedMergeView } from '@codemirror/merge'
import { search, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, highlightSpecialChars, keymap } from '@codemirror/view'
import { useTemplateRef, watch } from 'vue'

import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { codeEditorTheme, codeViewerFillTheme, codeViewerTheme } from '@/theme/code/editor'

export type CodeViewerLanguage = 'json' | 'design-jsx' | 'javascript' | 'css'

const {
  code,
  language,
  label,
  original,
  fill = false
} = defineProps<{
  code: string
  language: CodeViewerLanguage
  label: string
  /** Shows `code` as a unified diff against this text. Read at mount. */
  original?: string
  /** Take the parent's height instead of the 16rem cap. Read at mount. */
  fill?: boolean
}>()

function languageExtension(language: CodeViewerLanguage): Extension {
  if (language === 'json') return json()
  if (language === 'css') return css()
  return javascript({ jsx: true, typescript: true })
}

const view = useCodeMirror(useTemplateRef('host'), {
  doc: () => code,
  label: () => label,
  // Earlier extensions win in CodeMirror, so the fill theme goes before the 16rem cap.
  theme: (dark) => [fill ? codeViewerFillTheme : [], codeEditorTheme(dark), codeViewerTheme],
  extensions: [
    EditorState.readOnly.of(true),
    // The content is already a tab stop; saying so lets checkers see the scroller is reachable.
    EditorView.contentAttributes.of({ tabindex: '0' }),
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
    :data-fill="fill || undefined"
    class="max-h-64 overflow-hidden rounded border border-border data-[fill]:max-h-none [&_.cm-scroller]:scrollbar-thin"
  />
</template>
