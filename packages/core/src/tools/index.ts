export { CODEGEN_PROMPT } from './prompts'

export { getComponentCatalog, registerComponentCatalog } from './component-catalog'
export type {
  ComponentCatalog,
  ComponentCatalogInsertInput,
  ComponentCatalogLibraryAsset
} from './component-catalog'
export { ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS } from './registry'
export { exportImage } from './vector'
export {
  defineTool,
  nodeToResult,
  nodeSummary,
  requireNode,
  NodeNotFoundError,
  toolChangesDocument
} from './schema'
export type { ToolDef, ToolExecution, ToolCapability } from './schema'
export {
  isAtomicTool,
  isToolExposed,
  parseToolArgs,
  type ToolInterface,
  type ToolExposure
} from './schema'
export { toolNumber } from './input'
export { toolsToAI, buildDebugLog } from './ai-adapter'
export type { ToolLogEntry, ToolDebugLog, AIAdapterOptions, StepBudget } from './ai-adapter'
export { calcClusterConfidence, diffDocuments, diffPageLayersJSX, wrapEvalCode } from './analyze'
export type { DocumentDiff, DocumentDiffOptions, LayerJSXChange } from './analyze'
export {
  VALID_OVERLAP_CATEGORIES,
  VALID_OVERLAP_SCOPES,
  VALID_OVERLAP_SEVERITIES,
  parseOverlapCategories,
  parseOverlapScope,
  parseOverlapSeverity
} from './analyze/overlaps/params'
export { setPexelsAPIKey, setUnsplashAccessKey } from './stock-photo'
export { importSVG } from './create'
