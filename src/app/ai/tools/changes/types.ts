/** Images of the changed region before and after one AI edit, kept with the chat history. */
export interface ToolChangeImages {
  before: Blob | null
  after: Blob | null
  /** The after image with changed pixels highlighted; null when nothing visible changed. */
  highlight: Blob | null
  width: number
  height: number
  /** Share of the region's pixels that differ, from 0 to 1. */
  changedRatio: number
}

/** What one document-changing tool call did to its page, for review in the transcript. */
export interface ToolChange {
  toolCallId: string
  pageId: string
  /** Top-level layers added, removed, or changed. */
  nodeIds: string[]
  jsx: { before: string; after: string }
  /** Absent while rendering, or when previews are off. */
  images?: ToolChangeImages
}
