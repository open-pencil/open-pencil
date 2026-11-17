import { isEqual } from 'es-toolkit'

import type { SceneNode } from '@open-pencil/scene-graph'
import { BLACK } from '@open-pencil/scene-graph/constants'
import {
  isIconModified,
  readIcon,
  type Icon,
  type IconOptions
} from '@open-pencil/scene-graph/icons'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { restoreSubtree, snapshotSubtree } from '#core/editor/history/subtree'
import type { EditorContext } from '#core/editor/types'
import { pushCreatedSubtreesUndo } from '#core/editor/undo'
import { screenCenterInWorld } from '#core/geometry/viewport'
import { parseIconName } from '#core/icons/provider'
import { detachIcon, placeIcon, recolorIcon, swapIcon } from '#core/icons/render'
import type { IconData } from '#core/icons/types'

/** The size a picked icon is placed at, as Iconify sets draw them. */
const ICON_SIZE = 24

/**
 * Icon commands: insert, swap, and recolor, each one undo step. An icon is a frame of paths,
 * so inserting and swapping record the frame's whole subtree and swap between the copies.
 */
export function createIconActions(ctx: EditorContext) {
  async function fetchIcon(name: string, size: number, options?: IconOptions): Promise<IconData> {
    const icon = (await ctx.icons.icons([name], size, options)).get(name)
    if (!icon || icon.paths.length === 0) throw new Error(`Icon "${name}" not found`)
    return icon
  }

  /** Runs `change` on the icon `frameId`, undoably, putting back the subtree it had before. */
  function changeIcon(label: string, frameId: string, change: () => void): void {
    const frame = ctx.graph.getNode(frameId)
    const parentId = frame?.parentId
    if (!frame || !parentId) return
    const index = ctx.graph.getNode(parentId)?.childIds.indexOf(frameId) ?? -1
    const before = snapshotSubtree(ctx.graph, frameId)
    change()
    const after = snapshotSubtree(ctx.graph, frameId)
    const show = (snapshot: Map<string, SceneNode>) => () => {
      const root = snapshot.get(frameId)
      if (!root) return
      if (ctx.graph.getNode(frameId)) ctx.graph.deleteNode(frameId)
      restoreSubtree(ctx.graph, root, parentId, snapshot)
      if (index !== -1) ctx.graph.insertChildAt(frameId, parentId, index)
      ctx.requestRender()
    }
    ctx.undo.push({ label, forward: show(after), inverse: show(before) })
    ctx.requestRender()
  }

  /**
   * Places the icon `name` at the middle of the view, in the container being edited or the
   * page, and selects it; null when the document was replaced while the icon loaded.
   */
  async function insertIcon(name: string, color: Color = BLACK): Promise<string | null> {
    const graph = ctx.graph
    const icon = await fetchIcon(name, ICON_SIZE)
    // Opening another document while the icon loaded leaves nothing to insert it into.
    if (ctx.graph !== graph) return null
    const { width, height } = ctx.getViewportSize()
    const parentId = ctx.state.enteredContainerId ?? ctx.state.currentPageId
    const origin =
      parentId === ctx.state.currentPageId
        ? { x: 0, y: 0 }
        : ctx.graph.getAbsolutePosition(parentId)
    const center = screenCenterInWorld(ctx.state, width, height)
    const x = center.x - origin.x - ICON_SIZE / 2
    const y = center.y - origin.y - ICON_SIZE / 2
    const previousSelection = new Set(ctx.state.selectedIds)
    const frame = placeIcon(ctx.graph, parentId, icon, {
      size: ICON_SIZE,
      color,
      overrides: { x: Math.round(x), y: Math.round(y) }
    })
    pushCreatedSubtreesUndo(ctx, 'Insert icon', [frame.id], previousSelection)
    ctx.setSelectedIds(new Set([frame.id]))
    ctx.requestRender()
    return frame.id
  }

  /**
   * Draws the icon `name` fresh in the icon `frameId`, as one step called `label`. `edited` says
   * whether its paths were already edited when this was asked for; edits made since are kept.
   */
  async function drawIcon(
    label: string,
    frameId: string,
    name: string,
    options: IconOptions | undefined,
    edited: boolean
  ) {
    const graph = ctx.graph
    const frame = graph.getNode(frameId)
    const drawn = frame && readIcon(frame)
    const editedSince = () => !edited && frame !== undefined && isIconModified(graph, frame)
    if (!frame || !drawn || editedSince()) return
    const icon = await fetchIcon(name, Math.min(frame.width, frame.height), options)
    // The document or the frame may have been replaced while the icon loaded, the icon drawn
    // again by something outside these commands, such as a plugin, or its paths edited; this
    // drawing then gives way, so it never discards edits made after it was asked for.
    if (ctx.graph !== graph || graph.getNode(frameId) !== frame) return
    if (!isEqual(readIcon(frame), drawn) || editedSince()) return
    changeIcon(label, frameId, () => swapIcon(graph, frameId, icon))
  }

  /** The icon redraws asked for and not yet done, in the order they were asked. */
  let redraws: Promise<void> = Promise.resolve()

  /**
   * Runs `redraw` on the icon `frameId` once the redraws asked for before it are done, so it reads
   * the icon as they left it: a swap and an option change made while an icon is still loading both
   * apply, in order. A redraw that fails does not hold up the next, and one asked for in a document
   * that has since been replaced is not run in the new one. `redraw` learns whether the icon's paths
   * were edited when it was asked for, which is when someone chose to give those edits up.
   */
  function queueRedraw(
    frameId: string,
    redraw: (icon: Icon, edited: boolean) => Promise<void>
  ): Promise<void> {
    const graph = ctx.graph
    const asked = graph.getNode(frameId)
    const edited = asked ? isIconModified(graph, asked) : false
    const previous = redraws
    const next = (async () => {
      await Promise.allSettled([previous])
      if (ctx.graph !== graph) return
      const frame = graph.getNode(frameId)
      const icon = frame && readIcon(frame)
      if (icon) await redraw(icon, edited)
    })()
    redraws = next
    return next
  }

  /**
   * Draws the icon `name` in the icon `frameId`, keeping its size, position, and color, and how
   * it is drawn when the new icon is from the same set.
   */
  function swapIconGlyph(frameId: string, name: string): Promise<void> {
    return queueRedraw(frameId, async (current, edited) => {
      const sameSet = parseIconName(current.name)?.prefix === parseIconName(name)?.prefix
      await drawIcon('Swap icon', frameId, name, sameSet ? current.options : undefined, edited)
    })
  }

  /** Draws the icon `frameId` was placed as afresh, undoing edits to its paths. */
  function resetIcon(frameId: string): Promise<void> {
    return queueRedraw(frameId, (icon, edited) =>
      drawIcon('Reset icon', frameId, icon.name, icon.options, edited)
    )
  }

  /**
   * Draws the icon `frameId` afresh with `changes` to how it is drawn, such as its weight, keeping
   * the options it has otherwise. Edits to its paths are given up, as when it is reset.
   */
  function setIconOptions(frameId: string, changes: IconOptions): Promise<void> {
    return queueRedraw(frameId, (icon, edited) =>
      drawIcon('Change icon options', frameId, icon.name, { ...icon.options, ...changes }, edited)
    )
  }

  /** Makes the icon `frameId` plain artwork that keeps its paths; see `detachIcon`. */
  function detachIconFrame(frameId: string) {
    const frame = ctx.graph.getNode(frameId)
    if (!frame || !readIcon(frame)) return
    changeIcon('Detach icon', frameId, () => detachIcon(ctx.graph, frameId))
  }

  /**
   * Sets the color of the icon `frameId`'s tinted paths. Only their paints are recorded, so a
   * color drag batched into one step stays cheap.
   */
  function setIconColor(frameId: string, color: Color) {
    const paints = () =>
      ctx.graph.getChildren(frameId).map(({ id, fills, strokes }) => ({ id, fills, strokes }))
    const before = paints()
    recolorIcon(ctx.graph, frameId, color)
    const after = paints()
    const apply = (state: typeof before) => () => {
      for (const { id, ...rest } of state) ctx.graph.updateNode(id, rest)
      ctx.requestRender()
    }
    ctx.undo.push({ label: 'Change icon color', forward: apply(after), inverse: apply(before) })
    ctx.requestRender()
  }

  return {
    /** Where the editor's icons come from, for pickers to search and preview. */
    iconProvider: ctx.icons,
    insertIcon,
    swapIconGlyph,
    resetIcon,
    setIconOptions,
    detachIcon: detachIconFrame,
    setIconColor
  }
}
