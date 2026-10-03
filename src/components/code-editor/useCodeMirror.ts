import { Compartment, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { onBeforeUnmount, onMounted, shallowRef, watch, type ShallowRef } from 'vue'

import { resolvedAppTheme } from '@/app/shell/theme'

export interface CodeMirrorOptions {
  /** The document the editor opens with; later changes are the caller's to dispatch. */
  doc: () => string
  /** The editor's accessible name. */
  label: () => string
  /** The editor theme for the resolved app theme. */
  theme: (dark: boolean) => Extension
  /** Extensions fixed for the editor's lifetime. */
  extensions: Extension[]
  /** Extensions rebuilt in their own compartment whenever the reactive state they read changes. */
  reactive?: (() => Extension)[]
}

/**
 * A CodeMirror view mounted into `host` for the component's lifetime. The label, the theme,
 * and each `reactive` extension reconfigure in place, so the document, folds, and scroll
 * survive.
 */
export function useCodeMirror(
  host: Readonly<ShallowRef<HTMLElement | null>>,
  options: CodeMirrorOptions
): Readonly<ShallowRef<EditorView | undefined>> {
  const view = shallowRef<EditorView>()
  const configurable = [
    () => EditorView.contentAttributes.of({ 'aria-label': options.label() }),
    () => options.theme(resolvedAppTheme.value === 'dark'),
    ...(options.reactive ?? [])
  ].map((build) => ({ build, compartment: new Compartment() }))

  onMounted(() => {
    const parent = host.value
    if (!parent) return
    view.value = new EditorView({
      doc: options.doc(),
      parent,
      extensions: [
        ...options.extensions,
        ...configurable.map(({ build, compartment }) => compartment.of(build()))
      ]
    })
  })

  for (const { build, compartment } of configurable) {
    watch(build, (extension) => {
      view.value?.dispatch({ effects: compartment.reconfigure(extension) })
    })
  }

  onBeforeUnmount(() => view.value?.destroy())
  return view
}
