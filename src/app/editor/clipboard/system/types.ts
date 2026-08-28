import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { EditorStore } from '@/app/editor/active-store'

export interface ClipboardPayload {
  html: string
  plainText: string
}

export interface SystemClipboard {
  copy(store: EditorStore): Promise<boolean>
  paste(store: EditorStore, cursorPos?: Vector): Promise<boolean>
}

export type BrowserClipboardReadResult =
  | { available: false }
  | { available: true; html: string | null }

export interface BrowserClipboardIO {
  write(payload: ClipboardPayload): Promise<boolean>
  readHTML(): Promise<BrowserClipboardReadResult>
}
