import type { SceneGraph } from '@open-pencil/scene-graph'

import type { RotationPreview } from '#core/geometry'

import { stageIssueMarkers, type IssueMarkerStageOptions, type StagedIssueMarker } from './layout'
import type { DesignIssueMarker } from './types'

interface StageKey {
  graph: SceneGraph
  markers: readonly DesignIssueMarker[]
  pageId: string
  suppressed: string
  preview: RotationPreview | null | undefined
  canvasVersion: number
  positionPreviewVersion: number
}

/**
 * The staged issue markers a canvas keeps between frames. Staging walks every marked layer's
 * ancestors, so it is done once per change to the document, the markers, or what hides them,
 * and each frame only places the stage in its viewport.
 */
export class IssueMarkerStage {
  private staged: StagedIssueMarker[] = []
  private key: StageKey | null = null

  update(
    graph: SceneGraph,
    markers: readonly DesignIssueMarker[],
    options: IssueMarkerStageOptions,
    canvasVersion: number,
    positionPreviewVersion: number
  ): readonly StagedIssueMarker[] {
    const key: StageKey = {
      graph,
      markers,
      pageId: options.pageId,
      suppressed: options.suppressedIds ? [...options.suppressedIds].sort().join('\n') : '',
      preview: options.preview,
      canvasVersion,
      positionPreviewVersion
    }
    if (!this.key || !sameKey(this.key, key)) {
      this.staged = stageIssueMarkers(graph, markers, options)
      this.key = key
    }
    return this.staged
  }

  clear(): void {
    this.staged = []
    this.key = null
  }
}

function sameKey(a: StageKey, b: StageKey): boolean {
  return (
    a.graph === b.graph &&
    a.markers === b.markers &&
    a.pageId === b.pageId &&
    a.suppressed === b.suppressed &&
    a.preview === b.preview &&
    a.canvasVersion === b.canvasVersion &&
    a.positionPreviewVersion === b.positionPreviewVersion
  )
}
