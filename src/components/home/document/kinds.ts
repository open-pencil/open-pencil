import IconLucidePenTool from '~icons/lucide/pen-tool'
import IconLucideStickyNote from '~icons/lucide/sticky-note'

import type { DocumentKind } from '@open-pencil/scene-graph'

/** The icon each kind of document shows, on Home's create buttons and before its files' names. */
export const DOCUMENT_KIND_ICONS = {
  design: IconLucidePenTool,
  board: IconLucideStickyNote
} as const satisfies Record<DocumentKind, unknown>
