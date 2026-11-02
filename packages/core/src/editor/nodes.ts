import { pick } from 'es-toolkit/object'

import type { SceneNode } from '@open-pencil/scene-graph'
import { findInstanceAncestor, recordInstanceOverride } from '@open-pencil/scene-graph/instances'
import { cloneInstanceOverrideState } from '@open-pencil/scene-graph/instances/overrides'
import { styleDetachmentChanges } from '@open-pencil/scene-graph/shared-styles'
import { regionFillChanges } from '@open-pencil/scene-graph/vector-network'

import { isNodeFontLoaded } from '#core/canvas/text'
import { textAutoResizeChanges } from '#core/layout/text-auto-resize'
import { reconcileVariableLayouts } from '#core/layout/variables'
import { prepareTextFonts } from '#core/text/prepare'

import { applyBoundVisibilityEdit, bindsVisibility } from './components/authoring/visibility-edit'
import { createLayoutModeActions } from './layout-mode'
import { createNodePreviewActions } from './node-preview'
import { createNudgeActions } from './nudge'
import { refitContainers, refitGroupsAroundLayers } from './structure/group/bounds'
import { pathTextEditChanges } from './text/path-edit'
import type { EditorContext } from './types'
import { createVariableBindingActions } from './variable-bindings'

export function opacityFromBuffer(buffer: string): number {
  if (buffer === '0') return 1
  if (!/^\d+$/.test(buffer)) return 1
  const n = Number.parseInt(buffer, 10)
  if (!Number.isFinite(n)) return 1
  const percent = buffer.length === 1 ? n * 10 : n
  return Math.min(100, Math.max(0, percent)) / 100
}

/** Fields that decide which faces a text needs, or the characters it shows. */
const TEXT_FONT_FIELDS = [
  'text',
  'fontFamily',
  'fontWeight',
  'italic',
  'fontStyle',
  'fontVariations',
  'styleRuns',
  'textLanguage',
  'textCase'
] as const satisfies readonly (keyof SceneNode)[]

export function createNodeActions(ctx: EditorContext) {
  // Function declarations below are hoisted, so the preview can wrap updateNode here.
  const previewActions = createNodePreviewActions(ctx, updateNode)
  const layoutModeActions = createLayoutModeActions(ctx, previewActions.beginNodePreview)
  const nudgeActions = createNudgeActions(ctx)
  const variableBindingActions = createVariableBindingActions(ctx)

  function runChangedLayout(id: string, changes: Partial<SceneNode>) {
    // A layer's modes reach the layers inside it.
    if (changes.variableModes) reconcileVariableLayouts(ctx.graph, { subtrees: [id] })
    if (changes.visible !== undefined) refitGroupsAroundLayers(ctx, [id])
    if (changes.booleanOperation !== undefined) refitContainers(ctx, [id])
    ctx.runLayoutForNode(id)
  }

  /** Writes waiting for their text's fonts, by layer, so later writes to it land after them. */
  const waitingWrites = new Map<string, Promise<void>>()

  /**
   * The text a write would leave whose fonts the canvas cannot measure yet, as the write makes it;
   * null when the write changes no face or character, or its text is ready.
   */
  function unpreparedText(node: SceneNode, changes: Partial<SceneNode>): SceneNode | null {
    if (node.type !== 'TEXT' || !TEXT_FONT_FIELDS.some((field) => field in changes)) return null
    const renderer = ctx.getRenderer()
    // Without a canvas there are no fonts to wait for: layout estimates.
    if (!renderer?.fontsLoaded) return null
    const next = { ...node, ...changes }
    return isNodeFontLoaded(renderer, next) ? null : next
  }

  /**
   * Applies a write once the text it leaves has its fonts, as Figma applies a font only once it
   * has loaded it: at once when they are in, otherwise after preparing them. Layout then measures
   * the text in its own fonts, never in another face it would have to measure again.
   */
  function withTextFonts(id: string, changes: Partial<SceneNode>, apply: () => void): void {
    const waiting = waitingWrites.get(id)
    const node = ctx.graph.getNode(id)
    if (!waiting && (!node || !unpreparedText(node, changes))) {
      apply()
      return
    }
    const applyWhenPrepared = async () => {
      await waiting
      const current = ctx.graph.getNode(id)
      if (!current) return
      const next = unpreparedText(current, changes)
      if (next) await prepareTextFonts([next], { loadFont: ctx.loadFont })
      apply()
    }
    const settled = applyWhenPrepared().finally(() => {
      if (waitingWrites.get(id) === settled) waitingWrites.delete(id)
    })
    waitingWrites.set(id, settled)
  }

  /** The write to `id` still waiting for its text's fonts, if any, settling once it lands. */
  function textWriteSettled(id: string): Promise<void> | null {
    return waitingWrites.get(id) ?? null
  }

  function updateNode(id: string, changes: Partial<SceneNode>) {
    withTextFonts(id, changes, () => applyNodeUpdate(id, changes))
  }

  function applyNodeUpdate(id: string, changes: Partial<SceneNode>) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    // Path-edit last so its reflowed glyphs win over auto-resize's glyph clear
    // (path text is textAutoResize NONE so they don't collide today).
    const nextChanges = styleDetachmentChanges(node, {
      ...changes,
      ...regionFillChanges(node, changes),
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    })
    ctx.graph.updateNode(id, nextChanges)
    recordInstanceOverride(ctx.graph, id, Object.keys(nextChanges))
    runChangedLayout(id, nextChanges)
  }

  function updateNodeWithUndo(id: string, changes: Partial<SceneNode>, label = 'Update') {
    withTextFonts(id, changes, () => applyNodeUpdateWithUndo(id, changes, label))
  }

  function applyNodeUpdateWithUndo(id: string, changes: Partial<SceneNode>, label: string) {
    const node = ctx.graph.getNode(id)
    if (!node) return
    // A layer a boolean property shows or hides sets the property too, in the same undo step.
    // It takes the value even where the layer already shows it, so the two agree.
    const visible = changes.visible
    if (visible !== undefined && bindsVisibility(node)) {
      ctx.undo.runBatch(label, () => {
        recordNodeUpdate(node, changes, label)
        applyBoundVisibilityEdit(ctx, id, visible)
      })
      return
    }
    recordNodeUpdate(node, changes, label)
  }

  function recordNodeUpdate(node: SceneNode, changes: Partial<SceneNode>, label: string) {
    const { id } = node
    // Same ordering rationale as updateNode: reflowed path-text glyphs win.
    const nextChanges = styleDetachmentChanges(node, {
      ...changes,
      ...regionFillChanges(node, changes),
      ...textAutoResizeChanges(node, changes),
      ...pathTextEditChanges(node, changes)
    })
    const owner = findInstanceAncestor(ctx.graph, id)
    const previousOverrides = owner
      ? cloneInstanceOverrideState(owner.instanceOverrides)
      : undefined
    const previous = pick(
      node,
      Object.keys(nextChanges) as (keyof SceneNode)[]
    ) as Partial<SceneNode>
    ctx.graph.updateNode(id, nextChanges)
    recordInstanceOverride(ctx.graph, id, Object.keys(nextChanges))
    runChangedLayout(id, nextChanges)
    ctx.undo.push({
      label,
      forward: () => {
        ctx.graph.updateNode(id, nextChanges)
        recordInstanceOverride(ctx.graph, id, Object.keys(nextChanges))
        runChangedLayout(id, nextChanges)
      },
      inverse: () => {
        ctx.graph.updateNode(id, previous)
        if (owner && previousOverrides)
          ctx.graph.updateNode(owner.id, {
            instanceOverrides: cloneInstanceOverrideState(previousOverrides)
          })
        runChangedLayout(id, nextChanges)
      }
    })
    ctx.requestRender()
  }

  function setOpacity(opacity: number, coalesceKey?: string) {
    if (!Number.isFinite(opacity)) return
    const clamped = Math.max(0, Math.min(1, opacity))
    const ids = [...ctx.state.selectedIds]
    if (ids.length === 0) return
    const targets = ids.map((id) => ctx.graph.getNode(id)).filter((n): n is SceneNode => n != null)
    const changed = targets.filter((t) => t.opacity !== clamped)
    if (changed.length === 0) return
    ctx.undo.runBatch(
      'Set opacity',
      () => {
        for (const target of changed) {
          updateNodeWithUndo(target.id, { opacity: clamped }, 'Set opacity')
        }
      },
      coalesceKey
    )
  }

  return {
    updateNode,
    textWriteSettled,
    ...previewActions,
    updateNodeWithUndo,
    setOpacity,
    ...layoutModeActions,
    ...variableBindingActions,
    ...nudgeActions
  }
}

/** The editor's node writes; an edit made through them leaves the shared styles it changes. */
export type NodeActions = ReturnType<typeof createNodeActions>
