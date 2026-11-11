import { tryOnScopeDispose } from '@vueuse/core'
import { computed, getCurrentInstance, onDeactivated, ref, watch } from 'vue'

import { getAxisAlignedWorldBounds, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { computeBounds } from '@open-pencil/scene-graph/geometry'
import Matrix, { type Mat3 } from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { MIN_RESCALE, scaleRoots, snapshotScale } from '@open-pencil/scene-graph/scaling'

import { useEditor } from '#vue/editor/context'
import { useSelectedNodeState } from '#vue/editor/selection-state/nodes'
import { useSelectionState } from '#vue/editor/selection-state/use'
import { createScalePreview, type ScalePreview } from '#vue/shared/input/scale'

/** The box the Scale tool scales, and how it lies on the canvas. */
export interface ScaleBox {
  width: number
  height: number
  /** Draws the box from its own (0,0)…(width,height) on the canvas. */
  world: Mat3
}

/** The edit a field is scrubbing: the box it began from and the point it keeps. */
interface ScaleEdit {
  box: ScaleBox
  anchor: Vector
  preview: ScalePreview
}

/**
 * Headless state and actions for the Scale tool's panel, as Figma's: the selection's size, its
 * factor counted from the size it had when picked, and the anchor point. Width, height, and factor
 * fields show each scrubbed step on the canvas, as the canvas drag does, and record one undo step
 * when they commit.
 */
export function useScaleControls() {
  const editor = useEditor()
  const { selectedIds } = useSelectionState()
  // The selected layers as the panel shows them, previews included, so W and H follow a scrub.
  const { nodes: selected } = useSelectedNodeState(editor)

  /**
   * The box the handles show: a single layer's own, turned as it is, as Figma reports its size,
   * or the canvas box of a multi-selection, locked layers included.
   */
  const box = computed<ScaleBox | null>(() => {
    const nodes = selected.value
    if (scaleRoots(editor.graph, nodes).length === 0) return null
    if (nodes.length === 1) {
      const [node] = nodes
      return { width: node.width, height: node.height, world: getWorldMatrix(node, editor.graph) }
    }
    const bounds = computeBounds(nodes.map((node) => getAxisAlignedWorldBounds(node, editor.graph)))
    return {
      width: bounds.width,
      height: bounds.height,
      world: Matrix.translated(bounds.x, bounds.y)
    }
  })

  let edit: ScaleEdit | null = null

  // The factor counts from the size the selection had when the tool or the selection was picked;
  // a scrub still open on the layers before goes back rather than reach the new ones.
  const startWidth = ref(0)
  watch(
    () => [...selectedIds.value].join(','),
    () => {
      cancel()
      startWidth.value = box.value?.width ?? 0
    },
    // At once, so a field that commits right after the selection changes finds no edit to finish.
    { immediate: true, flush: 'sync' }
  )
  const factor = computed(() => {
    const width = box.value?.width ?? 0
    return startWidth.value > 0 ? Math.round((width / startWidth.value) * 100) / 100 : 1
  })
  const anchor = computed(() => editor.state.scaleAnchor)

  function begin(): ScaleEdit | null {
    if (edit) return edit
    const start = box.value
    if (!start) return null
    const { x, y } = editor.state.scaleAnchor
    const [ax, ay] = Matrix.mapPoints(start.world, [start.width * x, start.height * y])
    const roots = scaleRoots(editor.graph, editor.getSelectedNodes())
    edit = {
      box: start,
      anchor: { x: ax, y: ay },
      preview: createScalePreview(editor, snapshotScale(editor.graph, roots))
    }
    return edit
  }

  /** Shows the selection at the scale `scaleOf` works out from the box the edit began from. */
  function show(scaleOf: (start: ScaleBox) => number) {
    const current = begin()
    if (!current) return
    const scale = scaleOf(current.box)
    if (Number.isFinite(scale) && scale >= MIN_RESCALE) current.preview.show(scale, current.anchor)
  }

  function commit(scaleOf: (start: ScaleBox) => number) {
    show(scaleOf)
    edit?.preview.commit()
    edit = null
  }

  function cancel() {
    edit?.preview.cancel()
    edit = null
  }

  const toSize = (axis: 'width' | 'height', value: number) => (start: ScaleBox) =>
    value / start[axis]
  const toFactor = (value: number) => (start: ScaleBox) => (value * startWidth.value) / start.width

  tryOnScopeDispose(cancel)
  if (getCurrentInstance()) onDeactivated(cancel)

  return {
    box,
    factor,
    anchor,
    /** Sets the point of the box scaling keeps in place, as fractions of its size. */
    setAnchor: (point: Vector) => editor.setScaleAnchor(point),
    previewSize: (axis: 'width' | 'height', value: number) => show(toSize(axis, value)),
    commitSize: (axis: 'width' | 'height', value: number) => commit(toSize(axis, value)),
    /** Shows a factor counted from the size the selection had when picked. */
    previewFactor: (value: number) => show(toFactor(value)),
    commitFactor: (value: number) => commit(toFactor(value)),
    cancel
  }
}
