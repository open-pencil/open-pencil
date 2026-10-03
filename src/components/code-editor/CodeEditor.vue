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

import { DESIGN_JSX_ELEMENTS, type DesignJSXElement } from '@open-pencil/design-jsx'
import { useI18n } from '@open-pencil/vue'

import type { LayerIssue } from '@/app/code/layers/issues'
import type { LayerLinkSource } from '@/app/code/layers/links'
import { designJSXExtensions } from '@/components/code-editor/extensions'
import type { LayerSnippet } from '@/components/code-editor/layers/context'
import { layerIssueDiagnostics, setLayerIssues } from '@/components/code-editor/layers/issues'
import {
  layerLinks as layerLinksExtension,
  setLayerLinks
} from '@/components/code-editor/layers/links'
import { fromLayers, layerPatch } from '@/components/code-editor/layers/patch'
import { staleAttributes } from '@/components/code-editor/layers/stale'
import type { CodeEditorLanguage } from '@/components/code-editor/types'
import { useCodeMirror } from '@/components/code-editor/useCodeMirror'
import { codeEditorTheme } from '@/theme/code/editor'

const {
  modelValue,
  language = 'design-jsx',
  readOnly = false,
  label = 'Code',
  layerLinks = null,
  layerIssues = [],
  autofocus = false,
  describeLayer,
  layerSnippet
} = defineProps<{
  modelValue: string
  language?: CodeEditorLanguage
  readOnly?: boolean
  label?: string
  /** How elements in the code map to canvas layers; `null` when they do not. */
  layerLinks?: LayerLinkSource | null
  /** Design issues to underline on the code of their layers. */
  layerIssues?: readonly LayerIssue[]
  /** Places the caret at the end of the code once the editor mounts. */
  autofocus?: boolean
  /** Describes a linked layer as Design JSX, which enables patching the code from the canvas. */
  describeLayer?: (nodeId: string) => DesignJSXElement | null
  /** Design JSX for a layer added on the canvas, with the layer of each element. */
  layerSnippet?: LayerSnippet
}>()

const emit = defineEmits<{
  /** Text changed: typed by the person, or patched from the canvas (`layers`). */
  'update:modelValue': [value: string, origin: 'user' | 'layers']
  /** The layers of the element around the cursor, or `null` when there is none or focus left. */
  activeLayers: [nodeIds: readonly string[] | null]
}>()

const { code } = useI18n()

const RUNTIME_TYPES = new Map(
  DESIGN_JSX_ELEMENTS.map(({ name, runtimeType }) => [name, runtimeType])
)

let externalUpdate = false

function languageExtensions(language: CodeEditorLanguage): Extension {
  if (language === 'html-css') return html()
  return [
    javascript({ jsx: true, typescript: true }),
    ...(language === 'design-jsx' ? designJSXExtensions() : [])
  ]
}

/** Read-only code still takes a cursor, which picks the layer to mark on the canvas. */
function editableExtensions(readOnly: boolean): Extension {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.contentAttributes.of({ 'aria-readonly': String(readOnly) })
  ]
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
    layerLinksExtension({
      typeOf: (tagName) => RUNTIME_TYPES.get(tagName),
      onActive: (nodeIds) => emit('activeLayers', nodeIds),
      describe: (nodeId) => describeLayer?.(nodeId) ?? null,
      staleMessage: (stale) =>
        stale.kind === 'value'
          ? code.value.canvasChangedExpression({ value: stale.value })
          : code.value.canvasChangedOrder
    }),
    staleAttributes,
    layerIssueDiagnostics(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged || externalUpdate) return
      const patched = update.transactions.some((tr) => tr.annotation(fromLayers))
      emit('update:modelValue', update.state.doc.toString(), patched ? 'layers' : 'user')
    })
  ],
  reactive: [() => languageExtensions(language), () => editableExtensions(readOnly)]
})

/** Links and issues describe the current text, so they follow a text replacement. */
function syncLayers() {
  view.value?.dispatch({
    effects: [setLayerLinks.of(layerLinks), setLayerIssues.of(layerIssues)]
  })
}

function focusEnd() {
  const editor = view.value
  if (!editor) return
  editor.focus()
  editor.dispatch({ selection: { anchor: editor.state.doc.length } })
}

// The view exists once mounted; it then takes the links, issues and focus it was given.
watch(
  view,
  (editor) => {
    if (!editor) return
    syncLayers()
    if (autofocus) focusEnd()
  },
  { once: true }
)

/**
 * Replaces only the span that differs, so the cursor and scroll position outside it stay put
 * when regenerated code changes one value.
 */
function minimalChange(current: string, next: string) {
  let start = 0
  while (start < current.length && current[start] === next[start]) start++
  let end = 0
  while (
    end < current.length - start &&
    end < next.length - start &&
    current[current.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++
  }
  return { from: start, to: current.length - end, insert: next.slice(start, next.length - end) }
}

watch(
  () => modelValue,
  (value) => {
    const editor = view.value
    if (!editor || editor.state.doc.toString() === value) return
    externalUpdate = true
    editor.dispatch({
      changes: minimalChange(editor.state.doc.toString(), value),
      annotations: Transaction.addToHistory.of(false)
    })
    externalUpdate = false
    syncLayers()
  }
)

// A link source describes the text it arrived with; re-applying it after patches would link
// elements by stale lines, so only a new source re-links.
watch(
  () => layerLinks,
  (links) => view.value?.dispatch({ effects: setLayerLinks.of(links) })
)
watch(
  () => layerIssues,
  (issues) => view.value?.dispatch({ effects: setLayerIssues.of(issues) })
)

/**
 * Brings canvas changes to linked layers into the code as small edits, keeping everything else
 * as written. Returns whether the code changed.
 */
function patchFromLayers(): boolean {
  const editor = view.value
  if (!editor || !layerSnippet) return false
  const spec = layerPatch(editor.state, layerSnippet)
  if (!spec) return false
  const before = editor.state.doc
  editor.dispatch({
    ...spec,
    annotations: [fromLayers.of(true), Transaction.addToHistory.of(false)]
  })
  return editor.state.doc !== before
}

defineExpose({ patchFromLayers })
</script>

<template>
  <div
    ref="host"
    data-slot="code-editor"
    class="min-h-0 flex-1 overflow-hidden text-xs [&_.cm-scroller]:scrollbar-thin"
  />
</template>
