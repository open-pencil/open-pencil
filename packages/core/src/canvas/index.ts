export { canMakeBooleanSourceNode, canMakeBooleanSourcePath, nodeHasVisibleStroke } from './boolean'
export { flattenNodesToVectorProps, type VectorFlattenProps } from './flatten'
export {
  canOutlineStroke,
  layersToOutline,
  outlineStrokeLayer,
  type OutlinedLayer,
  type OutlinePiece
} from './outline-stroke'
export {
  distanceToGuideSegment,
  getGuideScreenSegment,
  type GuideScreenSegment,
  type GuideViewport
} from './guides/geometry'
export { computeGuideRedline } from './guides/redlines'
export { hitTestGuides, type GuideHit } from './guides/hit-test'
export type { GuideOverlayState, GuidePreview, GuideSelection } from './guides/types'
export { canvasLabelForeground } from './labels/color'
export type { ImagePreview, ImagePreviewDecoder } from './images/previews'
export {
  SkiaRenderer,
  type PresenceCursor,
  type RenderOverlays,
  type RulerTheme,
  type SelectionTheme
} from './renderer'
export {
  hitTestIssueMarkers,
  issueMarkerLabel,
  issueSeverityRank,
  layoutIssueMarkers,
  type IssueMarkerLayoutOptions,
  type IssueMarkerView
} from './issues/layout'
export type {
  DesignIssueHighlight,
  DesignIssueMarker,
  DesignIssueOverlay,
  DesignIssueSeverity,
  PlacedIssueMarker
} from './issues/types'
export { hitTestStatusLabels, type PlacedStatusLabel } from './labels/status'
export { LabelCache, type CachedComponent, type CachedSection } from './labels/cache'
export { withFigExportRuntime } from './text/shape'
export { drawnFontAxes, type DrawnFontAxes, type DrawnFontAxis } from './text/font-families'
