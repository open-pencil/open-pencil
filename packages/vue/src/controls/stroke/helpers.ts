import { compact } from 'es-toolkit/array'
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

function alignOf(node: SceneNode): Stroke['align'] {
  return node.strokes.at(0)?.align ?? node.strokeAlign
}

/** Changes every node's stroke alignment, including the one a node without strokes keeps. */
export function updateAlign(editor: Editor, nodes: readonly SceneNode[], align: Stroke['align']) {
  editor.undo.runBatch('Change stroke align', () => {
    for (const node of nodes) {
      const strokes = node.strokes.map((stroke) => ({ ...stroke, align }))
      editor.updateNodeWithUndo(node.id, { strokes, strokeAlign: align }, 'Change stroke align')
    }
  })
}

/** The alignment the nodes share, MIXED when they differ, as Figma's Position field shows. */
export function currentAlign(nodes: readonly SceneNode[]): MixedValue<Stroke['align']> {
  const first = nodes.at(0)
  if (!first) return 'CENTER'
  const align = alignOf(first)
  return nodes.every((node) => alignOf(node) === align) ? align : MIXED
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
  const count = compact(active).length
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

const BORDER_KEYS = {
  top: 'borderTopWeight',
  right: 'borderRightWeight',
  bottom: 'borderBottomWeight',
  left: 'borderLeftWeight'
} as const

function borderKey(side: (typeof BORDER_SIDES)[number]) {
  return BORDER_KEYS[side]
}

export function borderWeight(
  nodes: readonly SceneNode[],
  side: (typeof BORDER_SIDES)[number]
): MixedValue<number> {
  const first = nodes.at(0)
  if (!first) return 0
  const key = borderKey(side)
  return nodes.every((node) => node[key] === first[key]) ? first[key] : MIXED
}

export function createStrokeSideActions(editor: Editor, sideMenuOpen: Ref<boolean>) {
  function sideChanges(side: StrokeSides, node: SceneNode): Partial<SceneNode> {
    const weight = node.strokes.at(0)?.weight ?? 1
    if (side === 'ALL') {
      return {
        independentStrokeWeights: false,
        borderTopWeight: 0,
        borderRightWeight: 0,
        borderBottomWeight: 0,
        borderLeftWeight: 0
      }
    }
    if (side === 'CUSTOM') {
      const independent = node.independentStrokeWeights
      return {
        independentStrokeWeights: true,
        borderTopWeight: independent ? node.borderTopWeight : weight,
        borderRightWeight: independent ? node.borderRightWeight : weight,
        borderBottomWeight: independent ? node.borderBottomWeight : weight,
        borderLeftWeight: independent ? node.borderLeftWeight : weight
      }
    }
    return {
      independentStrokeWeights: true,
      borderTopWeight: side === 'TOP' ? weight : 0,
      borderRightWeight: side === 'RIGHT' ? weight : 0,
      borderBottomWeight: side === 'BOTTOM' ? weight : 0,
      borderLeftWeight: side === 'LEFT' ? weight : 0
    }
  }

  function selectSide(side: StrokeSides, nodes: readonly SceneNode[]) {
    const labels: Partial<Record<StrokeSides, string>> = {
      ALL: 'Stroke all sides',
      CUSTOM: 'Custom stroke sides'
    }
    const label = labels[side] ?? `Stroke ${side.toLowerCase()} only`
    editor.undo.runBatch(label, () => {
      for (const node of nodes) editor.updateNodeWithUndo(node.id, sideChanges(side, node), label)
    })
    sideMenuOpen.value = false
  }

  function updateBorderWeight(
    side: (typeof BORDER_SIDES)[number],
    value: number,
    nodes: readonly SceneNode[]
  ) {
    const key = borderKey(side)
    editor.undo.runBatch('Change stroke weight', () => {
      for (const node of nodes)
        editor.updateNodeWithUndo(node.id, { [key]: value }, 'Change stroke weight')
    })
  }

  return { selectSide, updateBorderWeight }
}
