export { analyzeClusters, calcClusterConfidence } from './analyze/clusters'
export { analyzeColors } from './analyze/colors'
export { diffCreate, diffShow } from './analyze/diff'
export { evalCode } from './analyze/eval'
export { wrapEvalCode } from './analyze/eval/wrap'
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
