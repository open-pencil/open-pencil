import type { FigSessionCheckpoint } from '@open-pencil/fig'
import type { FigPageManifestEntry } from '@open-pencil/kiwi/fig'

import type { FigImportOptions } from '#core/kiwi/fig/import'
import type { SerializedSceneGraph } from '#core/kiwi/fig/parse/transfer'
import type { FigPopulationDelta } from '#core/kiwi/fig/population/delta'

export interface FigSessionOpenRequest {
  type: 'open'
  originalBuffer: ArrayBuffer
  archiveBuffer: ArrayBuffer
  options?: FigImportOptions
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
  | FigSessionCancelRequest
  | FigSessionDisposeRequest

export type FigSessionResponse =
  | { type: 'page-manifest'; pages: FigPageManifestEntry[] }
  | {
      type: 'graph'
      graph?: SerializedSceneGraph
      checkpoint?: FigSessionCheckpoint
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
  | { type: 'disposed' }
