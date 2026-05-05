import {
  analyzeClusters,
  analyzeColors,
  analyzeSpacing,
  analyzeTypography,
  diffCreate,
  diffShow
} from './analyze'
import { designToComponentMap, designToTokens } from './codegen'
import {
  createComponent,
  createInstance,
  createPage,
  createShape,
  createSlice,
  createVector,
  fetchIconsTool,
  importSvg,
  insertIcon,
  searchIconsTool
} from './create'
import {
  setBlend,
  setConstraints,
  setEffects,
  setFont,
  setFontRange,
  setImageFill,
  setLocked,
  setMinMax,
  setOpacity,
  setRotation,
  setStrokeAlign,
  setTextResize,
  setVisible
} from './modify'
import {
  diffJsx,
  getComponents,
  getCurrentPage,
  getPageTree,
  listAvailableFonts,
  listFonts,
  listPages,
  pageBounds,
  queryNodes,
  selectNodes,
  switchPage
} from './read'
import type { ToolDef } from './schema'
import {
  arrangeNodes,
  cloneNode,
  flattenNodes,
  groupNodes,
  nodeAncestors,
  nodeBindings,
  nodeBounds,
  nodeChildren,
  nodeMove,
  nodeReplaceWith,
  nodeToComponent,
  nodeTree,
  renameNode,
  ungroupNode
} from './structure'
import {
  bindVariable,
  createCollection,
  createVariable,
  deleteCollection,
  deleteVariable,
  findVariables,
  getCollection,
  getVariable,
  listCollections,
  listVariables,
  setVariable
} from './variables'
import {
  booleanExclude,
  booleanIntersect,
  booleanSubtract,
  booleanUnion,
  exportImage,
  exportPdf,
  exportSvg,
  pathFlip,
  pathGet,
  pathMove,
  pathScale,
  pathSet,
  viewportGet,
  viewportSet
} from './vector'

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
  switchPage,
  pageBounds,
  listFonts,
  listAvailableFonts,
  diffJsx,
  // Create (advanced)
  createShape,
  searchIconsTool,
  insertIcon,
  fetchIconsTool,
  createComponent,
  createInstance,
  createPage,
  createVector,
  createSlice,
  importSvg,
  // Modify (advanced)
  setEffects,
  setOpacity,
  setFont,
  setVisible,
  setConstraints,
  setRotation,
  setMinMax,
  setFontRange,
  setTextResize,
  setBlend,
  setLocked,
  setStrokeAlign,
  setImageFill,
  // Structure (advanced)
  cloneNode,
  nodeMove,
  renameNode,
  groupNodes,
  ungroupNode,
  flattenNodes,
  nodeToComponent,
  nodeBounds,
  nodeAncestors,
  nodeChildren,
  nodeTree,
  nodeBindings,
  nodeReplaceWith,
  arrangeNodes,
  // Variables
  listVariables,
  listCollections,
  getVariable,
  findVariables,
  createVariable,
  setVariable,
  deleteVariable,
  bindVariable,
  getCollection,
  createCollection,
  deleteCollection,
  // Vector & export
  booleanUnion,
  booleanSubtract,
  booleanIntersect,
  booleanExclude,
  pathGet,
  pathSet,
  pathScale,
  pathFlip,
  pathMove,
  viewportGet,
  viewportSet,
  exportSvg,
  exportPdf,
  exportImage,
  // Analyze & diff
  analyzeColors,
  analyzeTypography,
  analyzeSpacing,
  analyzeClusters,
  diffCreate,
  diffShow,
  // Codegen
  designToTokens,
  designToComponentMap
]
