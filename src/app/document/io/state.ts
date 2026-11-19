import type { Editor, EditorState } from '@open-pencil/core'

import type { EditorPreparationController } from '@/app/editor/preparation/controller'

/** The editor state a document's file actions read and write, with the document's name. */
export type NamedDocumentState = EditorState & { documentName: string }

/** The state a document opens into, which also decides whether the side panels show. */
export interface OpenDocumentState extends NamedDocumentState {
  /** Whether the side panels show, which a document opens with as its kind starts it. */
  showUI: boolean
}

/** What opening a file into the editor needs, whatever the file's format. */
export interface OpenFileOptions {
  editor: Editor
  state: OpenDocumentState
  setDocumentSource: (
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) => void
  fitCurrentPageToViewport: (signal?: AbortSignal) => Promise<void>
  preparationController: EditorPreparationController
}
