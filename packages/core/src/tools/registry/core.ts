import { diffChanges, diffCreate, diffVisual, evalCode } from '#core/tools/analyze'
import { calc } from '#core/tools/calc'
import { render } from '#core/tools/create'
import { describe } from '#core/tools/describe'
import {
  setFill,
  setLayout,
  setLayoutChild,
  setRadius,
  setStroke,
  setText,
  setTextProperties,
  updateNode
} from '#core/tools/modify'
import { diffJSX, findNodes, getJSX, getNode, getSelection } from '#core/tools/read'
import type { ToolDef } from '#core/tools/schema'
import { stockPhoto } from '#core/tools/stock-photo'
import { batchUpdate, deleteNode, nodeResize, reparentNode } from '#core/tools/structure'
import { viewportZoomToFit } from '#core/tools/vector'

/**
 * Core tools registered by default in AI chat (26 tools, ~5K schema tokens).
 * Covers 90%+ of design sessions: render, describe, modify, structure, and diff checks.
 */
export const CORE_TOOLS: ToolDef[] = [
  // Read
  getSelection,
  getNode,
  findNodes,
  getJSX,
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
  diffChanges,
  diffCreate,
  diffJSX,
  diffVisual,
  calc,
  evalCode,
  viewportZoomToFit
]
