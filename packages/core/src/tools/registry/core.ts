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
import { findNodes, getJSX, getNode, getSelection } from '#core/tools/read'
import type { ToolDef } from '#core/tools/schema'
import { stockPhoto } from '#core/tools/stock-photo'
import { batchUpdate, deleteNodes, reparentNode } from '#core/tools/structure'
import { viewportZoomToFit } from '#core/tools/vector'
import { webSearch } from '#core/tools/web-search'

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
  deleteNodes,
  reparentNode,
  batchUpdate,
  // Stock photos and the web
  stockPhoto,
  webSearch,
  // Inspect & utility
  describe,
  diffChanges,
  diffCreate,
  diffVisual,
  calc,
  evalCode,
  viewportZoomToFit
]
