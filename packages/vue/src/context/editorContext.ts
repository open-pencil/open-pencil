import { inject, provide } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { InjectionKey } from 'vue'

export const EDITOR_KEY: InjectionKey<Editor> = Symbol('open-pencil-editor')

export function provideEditor(editor: Editor) {
  provide(EDITOR_KEY, editor)
}

export function useEditor(): Editor {
  const editor = inject(EDITOR_KEY)
  if (!editor) {
    throw new Error(
      '[open-pencil] useEditor() called outside <OpenPencilProvider>. ' +
        'Wrap your component tree with <OpenPencilProvider :editor="editor">.'
    )
  }
  return editor
}
