import {
  cloneInstanceOverrideState,
  setInstanceOverride,
  type InstanceOverrideState,
  type SceneNode
} from '@open-pencil/scene-graph'
import { copyDerivedGlyphs, copyGeometryPaths } from '@open-pencil/scene-graph/copy'

import { weightToStyle } from '#core/text/fonts'
import { hasGlyphOutlines } from '#core/text/opentype'

import { pathTextEditChanges } from './text/path-edit'
import {
  createTextEditSession,
  resizeTextNodeForEdit,
  snapshotTextNode,
  textSnapshotChanged,
  type TextEditSession
} from './text/session'
import type { EditorContext } from './types'

/**
 * Path text is edited by re-flowing glyph OUTLINES along its path. When the font
 * is unavailable we can't produce new glyphs, so editing would corrupt the baked
 * lettering — treat it as a baked graphic and refuse to enter edit mode. Non-path
 * text still edits (system-font fallback); path text with the font available
 * edits fully (add/remove characters reflow). "Available" is deliberately broad:
 * today that means loaded locally, but a future remote provider (e.g. Google
 * Fonts) would extend hasGlyphOutlines without changing this gate.
 */
function isPathTextEditable(node: SceneNode): boolean {
  if (!node.textPathData) return true
  return hasGlyphOutlines(node.fontFamily, weightToStyle(node.fontWeight, node.italic))
}

type PathTextEditSnapshot = Pick<
  SceneNode,
  'derivedTextGlyphs' | 'strokeGeometry' | 'textPathData' | 'textPathBox'
>

function snapshotPathText(
  node: SceneNode | undefined,
  includeClearedPathState = false
): PathTextEditSnapshot | null {
  if (!node || (!includeClearedPathState && !node.textPathData)) return null
  return {
    derivedTextGlyphs: copyDerivedGlyphs(node.derivedTextGlyphs),
    strokeGeometry: copyGeometryPaths(node.strokeGeometry),
    textPathData: node.textPathData ? structuredClone(node.textPathData) : null,
    textPathBox: node.textPathBox ? { ...node.textPathBox } : null
  }
}

type InstanceOverridesSnapshot = {
  instanceId: string
  instanceOverrides: InstanceOverrideState
}

function containingInstanceIds(ctx: EditorContext, nodeId: string): string[] {
  const ids: string[] = []
  let current = ctx.graph.getNode(nodeId)
  while (current?.parentId) {
    current = ctx.graph.getNode(current.parentId)
    if (current?.type === 'INSTANCE') ids.push(current.id)
  }
  return ids
}

function snapshotInstanceOverrides(
  ctx: EditorContext,
  instanceIds: string[]
): InstanceOverridesSnapshot[] {
  return instanceIds.flatMap((instanceId) => {
    const instance = ctx.graph.getNode(instanceId)
    return instance?.type === 'INSTANCE'
      ? [{ instanceId, instanceOverrides: cloneInstanceOverrideState(instance.instanceOverrides) }]
      : []
  })
}

function restoreInstanceOverrides(ctx: EditorContext, snapshots: InstanceOverridesSnapshot[]) {
  for (const snapshot of snapshots) {
    ctx.graph.updateNode(snapshot.instanceId, {
      instanceOverrides: cloneInstanceOverrideState(snapshot.instanceOverrides)
    })
  }
}

function applyTextInstanceOverride(
  ctx: EditorContext,
  instanceIds: string[],
  nodeId: string,
  text: string
) {
  for (const instanceId of instanceIds) {
    const instance = ctx.graph.getNode(instanceId)
    if (instance?.type !== 'INSTANCE') continue
    setInstanceOverride(instance.instanceOverrides, instance.id, nodeId, 'text', text)
    ctx.graph.updateNode(instance.id, { instanceOverrides: instance.instanceOverrides })
  }
}

export function createTextActions(ctx: EditorContext) {
  let activeSession: TextEditSession | null = null

  function updateTextEditNode(nodeId: string, changes: Partial<SceneNode>) {
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    ctx.graph.updateNode(nodeId, { ...changes, ...pathTextEditChanges(node, changes) })
  }

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    // Font-gated: unavailable-font path text stays a non-editable baked graphic.
    if (!isPathTextEditable(node)) return
    activeSession = createTextEditSession(node)
    ctx.state.editingTextId = nodeId
    if (te) {
      te.setRenderer(ctx.getRenderer())
      te.start(node)
    }
    ctx.requestRender()
  }

  function commitTextEdit() {
    const te = ctx.getTextEditor()
    if (!te?.isActive) {
      ctx.state.editingTextId = null
      activeSession = null
      return
    }
    const textState = te.state
    if (!textState) {
      te.stop()
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }
    const result = { nodeId: textState.nodeId, text: textState.text }
    const before = activeSession?.before ?? { text: '', styleRuns: [], size: {} }
    const beforePathText = activeSession?.beforePathText ?? null
    const node = ctx.graph.getNode(result.nodeId)
    const after = snapshotTextNode(node, result.text)
    after.text = result.text
    const sizeChanges =
      before.text !== after.text ? resizeTextNodeForEdit(node, textState.paragraph) : {}
    if (Object.keys(sizeChanges).length > 0) after.size = sizeChanges
    const changed = textSnapshotChanged(before, after)
    const containingInstances = containingInstanceIds(ctx, result.nodeId)
    const instanceOverridesBefore = snapshotInstanceOverrides(ctx, containingInstances)

    te.stop()

    if (!changed) {
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }

    updateTextEditNode(result.nodeId, {
      text: after.text,
      styleRuns: after.styleRuns,
      ...sizeChanges
    })
    const afterPathText = snapshotPathText(
      ctx.graph.getNode(result.nodeId),
      beforePathText !== null
    )
    if (before.text !== after.text) {
      applyTextInstanceOverride(ctx, containingInstances, result.nodeId, after.text)
    }
    const instanceOverridesAfter = snapshotInstanceOverrides(ctx, containingInstances)
    ctx.state.editingTextId = null
    activeSession = null

    ctx.undo.push({
      label: 'Edit text',
      forward: () => {
        ctx.graph.updateNode(result.nodeId, {
          text: after.text,
          styleRuns: after.styleRuns,
          ...after.size,
          ...afterPathText
        })
        restoreInstanceOverrides(ctx, instanceOverridesAfter)
      },
      inverse: () => {
        ctx.graph.updateNode(result.nodeId, {
          text: before.text,
          styleRuns: before.styleRuns,
          ...before.size,
          ...beforePathText
        })
        restoreInstanceOverrides(ctx, instanceOverridesBefore)
      }
    })
  }

  return { startTextEditing, updateTextEditNode, commitTextEdit }
}
