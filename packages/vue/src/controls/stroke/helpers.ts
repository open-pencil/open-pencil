import { computed, type ComputedRef, type Ref } from 'vue'

import { BLACK } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import { cloneVectorNetwork } from '@open-pencil/scene-graph'
import type { SceneNode, Stroke, StrokeCap, StrokeJoin } from '@open-pencil/scene-graph'

import { MIXED } from '#vue/controls/node-props/use'
import type { MixedValue } from '#vue/controls/node-props/use'

export type StrokeSides = 'ALL' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CUSTOM'

export const SIDE_OPTIONS: { value: StrokeSides; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'CUSTOM', label: 'Custom' }
]

export const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const

export const STROKE_CAP_VALUES: StrokeCap[] = [
  'NONE',
  'ROUND',
  'SQUARE',
  'ARROW_LINES',
  'ARROW_EQUILATERAL'
]

export function isStrokeCapValue(value: string): value is StrokeCap {
  return (STROKE_CAP_VALUES as string[]).includes(value)
}
export const DEFAULT_STROKE: Stroke = {
  type: 'SOLID',
  color: BLACK,
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}

export interface StrokeGeometryStateInput {
  nodes: ComputedRef<SceneNode[]>
  merged: <K extends keyof SceneNode>(key: K) => MixedValue<SceneNode[K]>
}

export interface StrokeGeometryActions {
  setCap: (value: StrokeCap) => void
  setJoin: (value: StrokeJoin) => void
  updateMiterLimit: (value: number) => void
  commitMiterLimit: (value: number) => void
}

export function createStrokeGeometryState({ nodes, merged }: StrokeGeometryStateInput) {
  return {
    advancedActive: computed(
      () => nodes.value.length > 0 && nodes.value.every((node) => node.strokes.length > 0)
    ),
    cap: computed(() => {
      // A vertex cap differing from the node cap means the path shows more
      // than one ending: report MIXED so any picker choice fires setCap.
      const hasVertexOverride = nodes.value.some((node) =>
        node.vectorNetwork?.vertices.some(
          (vertex) => vertex.strokeCap && vertex.strokeCap !== node.strokeCap
        )
      )
      return hasVertexOverride ? MIXED : merged('strokeCap')
    }),
    join: computed(() => merged('strokeJoin')),
    miterLimit: computed(() => merged('strokeMiterLimit'))
  }
}

export function createStrokeGeometryActions(
  editor: Editor,
  nodes: ComputedRef<SceneNode[]>
): StrokeGeometryActions {
  const originalMiterLimits = new Map<string, number>()

  function runForSelection(label: string, action: (node: SceneNode) => void) {
    const selected = nodes.value
    const run = () => selected.forEach(action)
    if (selected.length > 1) editor.undo.runBatch(label, run)
    else run()
  }

  function setCap(value: StrokeCap) {
    runForSelection('Change stroke cap', (node) => {
      const changes: Partial<SceneNode> = {
        strokeCap: value,
        strokes: node.strokes.map((stroke) => ({ ...stroke, cap: value }))
      }
      // The picker speaks for the whole path: stale per-vertex overrides would
      // silently win over the chosen cap on imported one-ended arrows.
      if (node.vectorNetwork?.vertices.some((vertex) => vertex.strokeCap)) {
        const network = cloneVectorNetwork(node.vectorNetwork)
        for (const vertex of network.vertices) delete vertex.strokeCap
        changes.vectorNetwork = network
      }
      editor.updateNodeWithUndo(node.id, changes, 'Change stroke cap')
    })
  }

  function setJoin(value: StrokeJoin) {
    runForSelection('Change stroke join', (node) => {
      editor.updateNodeWithUndo(
        node.id,
        { strokeJoin: value, strokes: node.strokes.map((stroke) => ({ ...stroke, join: value })) },
        'Change stroke join'
      )
    })
  }

  function updateMiterLimit(value: number) {
    for (const node of nodes.value) {
      if (!originalMiterLimits.has(node.id)) originalMiterLimits.set(node.id, node.strokeMiterLimit)
      editor.updateNode(node.id, { strokeMiterLimit: Math.max(1, value) })
    }
  }

  function commitMiterLimit(value: number) {
    if (originalMiterLimits.size === 0) updateMiterLimit(value)
    runForSelection('Change stroke miter limit', (node) => {
      const previous = originalMiterLimits.get(node.id)
      if (previous === undefined) return
      editor.commitNodeUpdate(node.id, { strokeMiterLimit: previous }, 'Change stroke miter limit')
    })
    originalMiterLimits.clear()
  }

  return { setCap, setJoin, updateMiterLimit, commitMiterLimit }
}

export function updateAlign(editor: Editor, align: Stroke['align'], activeNode: SceneNode | null) {
  if (!activeNode) return
  const strokes = activeNode.strokes.map((s) => ({ ...s, align }))
  editor.updateNodeWithUndo(activeNode.id, { strokes }, 'Change stroke align')
}

export function currentAlign(activeNode: SceneNode | null): Stroke['align'] {
  if (!activeNode || activeNode.strokes.length === 0) return 'CENTER'
  return activeNode.strokes[0].align
}

export function currentSides(activeNode: SceneNode | null): StrokeSides {
  if (!activeNode?.independentStrokeWeights) return 'ALL'
  const {
    borderTopWeight: t,
    borderRightWeight: r,
    borderBottomWeight: b,
    borderLeftWeight: l
  } = activeNode
  const active = [t > 0, r > 0, b > 0, l > 0]
  const count = active.filter(Boolean).length
  if (count === 4 && t === r && r === b && b === l) return 'ALL'
  if (count === 1) {
    if (t > 0) return 'TOP'
    if (b > 0) return 'BOTTOM'
    if (l > 0) return 'LEFT'
    if (r > 0) return 'RIGHT'
  }
  return 'CUSTOM'
}

export function dashState(stroke: Stroke | undefined): { dash: number; gap: number; on: boolean } {
  const pattern = stroke?.dashPattern
  if (!pattern || pattern.length === 0) return { dash: 6, gap: 6, on: false }
  const dash = pattern[0]
  return { dash, gap: pattern[1] ?? dash, on: true }
}

export function toggleDash(stroke: Stroke | undefined): Partial<Stroke> {
  const { dash, gap, on } = dashState(stroke)
  return { dashPattern: on ? [] : [Math.max(dash, 1), Math.max(gap, 1)] }
}

export function setDash(stroke: Stroke | undefined, value: number): Partial<Stroke> {
  const { gap } = dashState(stroke)
  return { dashPattern: [Math.max(1, value), gap] }
}

export function setGap(stroke: Stroke | undefined, value: number): Partial<Stroke> {
  const { dash } = dashState(stroke)
  return { dashPattern: [dash, Math.max(1, value)] }
}

export function borderWeight(activeNode: SceneNode | null, side: (typeof BORDER_SIDES)[number]) {
  if (!activeNode) return 0
  const key = `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
  const value = activeNode[key]
  return typeof value === 'number' ? value : 0
}

export function createStrokeSideActions(editor: Editor, sideMenuOpen: Ref<boolean>) {
  function selectSide(side: StrokeSides, activeNode: SceneNode | null) {
    if (!activeNode) return
    const weight = activeNode.strokes.length > 0 ? activeNode.strokes[0].weight : 1
    if (side === 'ALL') {
      editor.updateNodeWithUndo(
        activeNode.id,
        {
          independentStrokeWeights: false,
          borderTopWeight: 0,
          borderRightWeight: 0,
          borderBottomWeight: 0,
          borderLeftWeight: 0
        } as Partial<SceneNode>,
        'Stroke all sides'
      )
    } else if (side === 'CUSTOM') {
      const w = activeNode.independentStrokeWeights
        ? {
            top: activeNode.borderTopWeight,
            right: activeNode.borderRightWeight,
            bottom: activeNode.borderBottomWeight,
            left: activeNode.borderLeftWeight
          }
        : { top: weight, right: weight, bottom: weight, left: weight }
      editor.updateNodeWithUndo(
        activeNode.id,
        {
          independentStrokeWeights: true,
          borderTopWeight: w.top,
          borderRightWeight: w.right,
          borderBottomWeight: w.bottom,
          borderLeftWeight: w.left
        } as Partial<SceneNode>,
        'Custom stroke sides'
      )
    } else {
      editor.updateNodeWithUndo(
        activeNode.id,
        {
          independentStrokeWeights: true,
          borderTopWeight: side === 'TOP' ? weight : 0,
          borderRightWeight: side === 'RIGHT' ? weight : 0,
          borderBottomWeight: side === 'BOTTOM' ? weight : 0,
          borderLeftWeight: side === 'LEFT' ? weight : 0
        } as Partial<SceneNode>,
        `Stroke ${side.toLowerCase()} only`
      )
    }
    sideMenuOpen.value = false
  }

  function updateBorderWeight(
    side: (typeof BORDER_SIDES)[number],
    value: number,
    activeNode: SceneNode | null
  ) {
    if (!activeNode) return
    const key = `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
    editor.updateNodeWithUndo(
      activeNode.id,
      { [key]: value } as Partial<SceneNode>,
      'Change stroke weight'
    )
  }

  return { selectSide, updateBorderWeight }
}
