import type {
  DocumentColorSpace,
  DocumentKind,
  SceneGraph,
  SceneGraphEvents
} from '@open-pencil/scene-graph'
import type { BindingScope } from '@open-pencil/scene-graph/variables'

/** The editor events a room follows to send this peer's edits. */
export interface CollabEditorEvents extends Omit<SceneGraphEvents, 'node:previewUpdated'> {
  'history:changed': () => void
  'document:libraries-changed': () => void
  'document:color-space-changed': (colorSpace: DocumentColorSpace) => void
  'document:kind-changed': (kind: DocumentKind) => void
}

/**
 * What a room needs of the editor it keeps in step: the graph it edits, the events of local
 * edits, and the refreshes a peer's edit asks for. An editor in the app, or a graph a server builds
 * a revision from, with no events and nothing to redraw.
 */
export interface CollabEditor {
  /** The graph the editor shows now; opening another document replaces it. */
  readonly graph: SceneGraph
  /** Whether this peer only receives the room's changes and sends none of its own. */
  isReadOnly(): boolean
  onEditorEvent<K extends keyof CollabEditorEvents>(
    event: K,
    handler: CollabEditorEvents[K]
  ): () => void
  /** Redraws after a peer's edit changed the graph. */
  requestRender(): void
  /** Lays out again the layers bound to these variables, after a peer changed them. */
  refreshVariables(scope: BindingScope): void
  /** Applies the document settings a peer changed: libraries, color space, kind. */
  refreshDocumentSettings(): void
}
