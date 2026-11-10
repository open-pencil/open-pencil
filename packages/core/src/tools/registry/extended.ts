import {
  analyzeClusters,
  analyzeColors,
  analyzeOverlaps,
  analyzeSpacing,
  analyzeTypography,
  diffApply,
  diffShow,
  lint,
  lintFix
} from '#core/tools/analyze'
import { designToComponentMap, designToTokens, importDesignTokens } from '#core/tools/codegen'
import { addComment, getComments, replyToComment, resolveComment } from '#core/tools/comments'
import {
  createInstance,
  createPage,
  createConnectorTool,
  createShape,
  createSlice,
  createVector,
  exposeInstanceSwap,
  combineAsVariants,
  createSlot,
  fetchIconsTool,
  getBehaviour,
  importMermaid,
  importSVG,
  insertIcon,
  searchIconsTool,
  setBehaviour
} from '#core/tools/create'
import {
  setBlend,
  setConstraints,
  setEffects,
  setFont,
  setFontRange,
  setImageFill,
  setMinMax
} from '#core/tools/modify'
import {
  diffJSX,
  getComponents,
  getCurrentPage,
  getFontStatus,
  getPageTree,
  insertLibraryComponent,
  listAvailableFonts,
  listLibraries,
  listPages,
  pageBounds,
  queryNodes,
  selectNodes,
  switchPage
} from '#core/tools/read'
import type { ToolDef } from '#core/tools/schema'
import { getStatuses, setStatus } from '#core/tools/statuses'
import {
  arrangeNodes,
  cloneNode,
  flattenNodes,
  groupNodes,
  nodeAncestors,
  nodeBindings,
  nodeBounds,
  nodeReplaceWith,
  nodeToComponent,
  ungroupNode
} from '#core/tools/structure'
import {
  bindVariable,
  createCollection,
  createVariable,
  deleteCollection,
  deleteVariable,
  getCollection,
  getVariable,
  listCollections,
  listVariables,
  setVariable
} from '#core/tools/variables'
import {
  booleanOperation,
  exportImage,
  exportPDF,
  exportSVG,
  pathGet,
  pathSet,
  pathTransform,
  viewportGet,
  viewportSet
} from '#core/tools/vector'

/**
 * Extended tools not in CORE_TOOLS — variables, vector ops, analysis,
 * codegen, advanced structure, path manipulation, etc.
 */
export const EXTENDED_TOOLS: ToolDef[] = [
  // Read (advanced)
  getPageTree,
  getCurrentPage,
  listPages,
  selectNodes,
  queryNodes,
  getComponents,
  listLibraries,
  insertLibraryComponent,
  switchPage,
  pageBounds,
  getComments,
  addComment,
  replyToComment,
  resolveComment,
  getStatuses,
  setStatus,
  getFontStatus,
  listAvailableFonts,
  // Create (advanced)
  createShape,
  searchIconsTool,
  insertIcon,
  fetchIconsTool,
  combineAsVariants,
  createInstance,
  exposeInstanceSwap,
  createSlot,
  getBehaviour,
  setBehaviour,
  createPage,
  createVector,
  createSlice,
  createConnectorTool,
  importSVG,
  importMermaid,
  // Modify (advanced)
  setEffects,
  setFont,
  setConstraints,
  setMinMax,
  setFontRange,
  setBlend,
  setImageFill,
  // Structure (advanced)
  cloneNode,
  groupNodes,
  ungroupNode,
  flattenNodes,
  nodeToComponent,
  nodeBounds,
  nodeAncestors,
  nodeBindings,
  nodeReplaceWith,
  arrangeNodes,
  // Variables
  listVariables,
  listCollections,
  getVariable,
  createVariable,
  setVariable,
  deleteVariable,
  bindVariable,
  getCollection,
  createCollection,
  deleteCollection,
  // Vector & export
  booleanOperation,
  pathGet,
  pathSet,
  pathTransform,
  viewportGet,
  viewportSet,
  exportSVG,
  exportPDF,
  exportImage,
  // Analyze & diff
  analyzeColors,
  analyzeTypography,
  lint,
  lintFix,
  analyzeSpacing,
  analyzeClusters,
  analyzeOverlaps,
  diffShow,
  diffApply,
  diffJSX,
  // Codegen
  designToTokens,
  importDesignTokens,
  designToComponentMap
]
