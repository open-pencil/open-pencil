import type { ToolDef } from './schema'

import {
  getSelection, getPageTree, getNode, findNodes, getComponents,
  listPages, switchPage, getCurrentPage, pageBounds, selectNodes, listFonts
} from './read'
import {
  createShape, render, createComponent, createInstance,
  createPage, createVector, createSlice
} from './create'
import {
  setFill, setStroke, setEffects, updateNode, setLayout, setConstraints,
  setRotation, setOpacity, setRadius, setMinMax, setText, setFont, setFontRange,
  setTextResize, setVisible, setBlend, setLocked, setStrokeAlign,
  setTextProperties, setLayoutChild
} from './modify'
import {
  deleteNode, cloneNode, renameNode, reparentNode, groupNodes, ungroupNode,
  flattenNodes, nodeToComponent, nodeBounds, nodeMove, nodeResize,
  nodeAncestors, nodeChildren, nodeTree, nodeBindings, nodeReplaceWith, arrangeNodes
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

export const ALL_TOOLS: ToolDef[] = [
  // Read
  getSelection,
  getPageTree,
  getNode,
  findNodes,
  getComponents,
  listPages,
  switchPage,
  getCurrentPage,
  pageBounds,
  selectNodes,
  listFonts,
  // Create
  createShape,
  render,
  createComponent,
  createInstance,
  createPage,
  createVector,
  createSlice,
  // Modify
  setFill,
  setStroke,
  setEffects,
  updateNode,
  setLayout,
  setConstraints,
  setRotation,
  setOpacity,
  setRadius,
  setMinMax,
  setText,
  setFont,
  setFontRange,
  setTextResize,
  setVisible,
  setBlend,
  setLocked,
  setStrokeAlign,
  setTextProperties,
  setLayoutChild,
  // Structure
  deleteNode,
  cloneNode,
  renameNode,
  reparentNode,
  groupNodes,
  ungroupNode,
  flattenNodes,
  nodeToComponent,
  nodeBounds,
  nodeMove,
  nodeResize,
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
  viewportZoomToFit,
  exportSvg,
  exportImage,
  // Analyze & diff
  analyzeColors,
  analyzeTypography,
  analyzeSpacing,
  analyzeClusters,
  diffCreate,
  diffShow,
  // Eval
  evalCode
]
