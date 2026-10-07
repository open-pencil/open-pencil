export { analyzeClusters, calcClusterConfidence } from './analyze/clusters'
export { analyzeColors } from './analyze/colors'
export {
  diffApply,
  diffChanges,
  diffCreate,
  diffDocuments,
  diffPageLayersJSX,
  diffShow,
  diffVisual
} from './analyze/diff'
export type { DocumentDiff, DocumentDiffOptions, LayerJSXChange } from './analyze/diff'
export { evalCode } from './analyze/eval'
export { lint, lintFix } from './analyze/lint'
export { compileScript, wrapEvalCode } from './analyze/eval/wrap'
export { analyzeOverlaps, computeOverlaps } from './analyze/overlaps'
export type {
  AnalyzeOverlapsArgs,
  AnalyzeOverlapsResult,
  AnalyzeOverlapsSummary,
  OverlapCategory,
  OverlapIntersection,
  OverlapItem,
  OverlapNodeSummary,
  OverlapScope,
  OverlapSeverity
} from './analyze/overlaps'
export { analyzeSpacing } from './analyze/spacing'
export { analyzeTypography } from './analyze/typography'
