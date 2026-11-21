import { inject, provide } from 'vue'
import type { InjectionKey, MaybeRefOrGetter } from 'vue'

import type { Editor } from '@open-pencil/core'
import type { ColorProfile } from '@open-pencil/scene-graph'

import { provideColorSpace, provideEditorColorSpaces } from '#vue/controls/color-model/space'

/**
 * Injection key for the current OpenPencil editor instance.
 *
 * Most SDK consumers should use {@link provideEditor} and {@link useEditor}
 * instead of interacting with this symbol directly.
 */
export const EDITOR_KEY: InjectionKey<Editor> = Symbol('open-pencil-editor')

export interface ProvideEditorOptions {
  /**
   * The profiles colors below are stored and shown in, for a host that tracks them itself, such
   * as one whose editor follows the active tab. By default they follow `editor`'s document and the
   * profile its canvas reports presenting.
   */
  colorSpaces?: { stored: MaybeRefOrGetter<ColorProfile>; shown: MaybeRefOrGetter<ColorProfile> }
}

/**
 * Provides an OpenPencil editor instance to the current Vue subtree.
 *
 * Call this once near the top of your editor shell so descendant composables
 * and headless primitives can access the editor with {@link useEditor}.
 */
export function provideEditor(editor: Editor, options: ProvideEditorOptions = {}) {
  provide(EDITOR_KEY, editor)
  // Swatches and pickers below show the document's colors as its canvas presents them.
  if (options.colorSpaces) provideColorSpace(options.colorSpaces.stored, options.colorSpaces.shown)
  else provideEditorColorSpaces(editor)
}

/**
 * Returns the current injected OpenPencil editor.
 *
 * Throws if called outside a subtree where {@link provideEditor} has already
 * been called.
 */
export function useEditor(): Editor {
  const editor = inject(EDITOR_KEY)
  if (!editor) {
    throw new Error(
      '[open-pencil] useEditor() called without an injected editor. ' +
        'Call provideEditor(editor) near the top of your Vue subtree first.'
    )
  }
  return editor
}
