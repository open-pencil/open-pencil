import type { ToolDef } from './schema'

import {
  getSelection, getPageTree, getNode, findNodes, queryNodes, getComponents,
  listPages, switchPage, getCurrentPage, pageBounds, selectNodes, listFonts,
  getJsx, diffJsx
} from './read'
import {
  createShape, render, createComponent, createInstance,
  createPage, createVector, createSlice, fetchIconsTool, insertIcon, searchIconsTool
} from './create'
import {
  setFill, setStroke, setEffects, updateNode, setLayout, setConstraints,
  setRotation, setOpacity, setRadius, setMinMax, setText, setFont, setFontRange,
  setTextResize, setVisible, setBlend, setLocked, setStrokeAlign,
  setTextProperties, setLayoutChild, setImageFill
} from './modify'
import {
  deleteNode, cloneNode, renameNode, reparentNode, groupNodes, ungroupNode,
  flattenNodes, nodeToComponent, nodeBounds, nodeMove, nodeResize,
  nodeAncestors, nodeChildren, nodeTree, nodeBindings, nodeReplaceWith, arrangeNodes,
  batchUpdate
} from './structure'
import {
  listVariables, listCollections, getVariable, findVariables,
  createVariable, setVariable, deleteVariable, bindVariable,
  getCollection, createCollection, deleteCollection
} from './variables'
import {
  booleanUnion, booleanSubtract, booleanIntersect, booleanExclude,
  pathGet, pathSet, pathScale, pathFlip, pathMove,
  viewportGet, viewportSet, viewportZoomToFit,
  exportSvg, exportImage
} from './vector'
import {
  analyzeColors, analyzeTypography, analyzeSpacing, analyzeClusters,
  diffCreate, diffShow, evalCode
} from './analyze'
import { describe } from './describe'
import { designToTokens, designToComponentMap } from './codegen'
import { calc } from './calc'
import { stockPhoto } from './stock-photo'

/**
 * Core tools registered by default in AI chat (~30 tools, ~3K schema tokens).
 * Covers 90%+ of design sessions: render, describe, modify, structure, icons.
 */
export const CORE_TOOLS: ToolDef[] = [
  // Read
  getSelection,
  getNode,
  findNodes,
  getJsx,
  // Create
  render,
  // Modify
  updateNode,
  setLayout,
  setLayoutChild,
  setRadius,
  setFill,
  setStroke,
  setText,
  setTextProperties,
  // Structure
  deleteNode,
  reparentNode,
  nodeResize,
  batchUpdate,
  // Stock photos
  stockPhoto,
  // Inspect & utility
  describe,
  calc,
  evalCode,
  viewportZoomToFit,
]

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
  designToComponentMap,
]

/** All tools combined — used by MCP server and CLI. */
export const ALL_TOOLS: ToolDef[] = [...CORE_TOOLS, ...EXTENDED_TOOLS]
