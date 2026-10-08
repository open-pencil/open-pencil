import type {
  FigArchiveRecordInfo,
  FigPatchedArchiveInput,
  FigRecordPatch,
  FigSessionCheckpoint
} from '@open-pencil/fig'
import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'

import type { ParseFigFileOptions } from '#core/io/formats/fig/read'
import type { SerializedSceneGraph } from '#core/kiwi/fig/parse/transfer'
import type { FigPopulationDelta } from '#core/kiwi/fig/population/delta'

export interface FigSessionOpenRequest {
  type: 'open'
  /** The file, transferred; the worker keeps its own copy as the original archive. */
  buffer: ArrayBuffer
  options?: Pick<ParseFigFileOptions, 'populate'>
  port: MessagePort
}

export interface FigSessionPopulateRequest {
  type: 'populate'
  requestId: string
  baseRevision: number
  pageId: string
}

export interface FigSessionOriginalArchiveRequest {
  type: 'original-archive'
  requestId: string
}

export interface FigSessionArchiveInfoRequest {
  type: 'archive-info'
  requestId: string
}

export interface FigSessionComponentPagesRequest {
  type: 'component-pages'
  requestId: string
  /** Archive GUIDs of the components, as `session:local`. */
  componentIds: string[]
}

export interface FigSessionPatchArchiveRequest {
  type: 'patch-archive'
  requestId: string
  patch: FigRecordPatch
  input: FigPatchedArchiveInput
}

/** The graph diverged from the worker's: stop loading pages there, keep the archive. */
export interface FigSessionRetireRequest {
  type: 'retire'
}

export interface FigSessionCancelRequest {
  type: 'cancel'
  requestId?: string
}

export interface FigSessionDisposeRequest {
  type: 'dispose'
}

export type FigSessionRequest =
  | FigSessionPopulateRequest
  | FigSessionOriginalArchiveRequest
  | FigSessionArchiveInfoRequest
  | FigSessionComponentPagesRequest
  | FigSessionPatchArchiveRequest
  | FigSessionRetireRequest
  | FigSessionCancelRequest
  | FigSessionDisposeRequest

export type FigSessionResponse =
  | { type: 'page-manifest'; pages: FigPageManifestEntry[] }
  | {
      type: 'graph'
      graph?: SerializedSceneGraph
      checkpoint?: FigSessionCheckpoint
      /** Taken while the records are decoded, for writing the archive back later. */
      archiveInfo?: FigArchiveRecordInfo
      error?: string
    }
  | {
      type: 'population-result'
      requestId: string
      baseRevision: number
      populated: boolean
      checkpoint?: FigSessionCheckpoint
      delta: FigPopulationDelta
    }
  | { type: 'population-error'; requestId?: string; error: string }
  | { type: 'original-archive-result'; requestId: string; bytes: Uint8Array }
  | { type: 'archive-info-result'; requestId: string; info: FigArchiveRecordInfo }
  | { type: 'component-pages-result'; requestId: string; pageIds: string[] }
  | { type: 'patch-archive-result'; requestId: string; bytes: Uint8Array }
  | { type: 'archive-error'; requestId: string; error: string }
  | { type: 'disposed' }
