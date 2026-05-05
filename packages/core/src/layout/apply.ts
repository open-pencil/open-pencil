import type { Node as YogaNode } from 'yoga-layout'

import type { SceneGraph, SceneNode } from '#core/scene-graph'

export type ComputeLayoutFn = (graph: SceneGraph, frameId: string) => void

function applyFrameSize(graph: SceneGraph, frame: SceneNode, yogaNode: YogaNode): void {
  if (frame.layoutMode === 'GRID') {
    if (frame.gridTemplateRows.length === 0) {
      graph.updateNode(frame.id, { height: yogaNode.getComputedHeight() })
    }
    return
  }

  if (frame.primaryAxisSizing !== 'HUG' && frame.counterAxisSizing !== 'HUG') return

  const computedW = yogaNode.getComputedWidth()
  const computedH = yogaNode.getComputedHeight()
  const updates: Partial<SceneNode> = {}

  const derived = frame.figmaDerivedLayout
  if (frame.primaryAxisSizing === 'HUG') {
    if (frame.layoutMode === 'HORIZONTAL') updates.width = derived?.width ?? computedW
    else updates.height = derived?.height ?? computedH
  }
  if (frame.counterAxisSizing === 'HUG') {
    if (frame.layoutMode === 'HORIZONTAL') updates.height = derived?.height ?? computedH
    else updates.width = derived?.width ?? computedW
  }

  graph.updateNode(frame.id, updates)
}

function updateChildFromYoga(graph: SceneGraph, child: SceneNode, yogaChild: YogaNode): void {
  if (!child.visible || child.layoutPositioning === 'ABSOLUTE' || child.type === 'INSTANCE') return

  const derived = child.figmaDerivedLayout
  graph.updateNode(child.id, {
    x: derived?.x ?? yogaChild.getComputedLeft(),
    y: derived?.y ?? yogaChild.getComputedTop(),
    width: derived?.width ?? yogaChild.getComputedWidth(),
    height: derived?.height ?? yogaChild.getComputedHeight()
  })
}

function recomputeGridChild(
  graph: SceneGraph,
  child: SceneNode,
  computeLayout: ComputeLayoutFn
): void {
  const updated = graph.getNode(child.id)
  if (!updated || updated.layoutMode === 'NONE') return

  const savedPrimary = updated.primaryAxisSizing
  const savedCounter = updated.counterAxisSizing
  const updates: Partial<SceneNode> = {}

  if (savedPrimary === 'HUG') updates.primaryAxisSizing = 'FIXED'
  if (savedCounter === 'HUG') updates.counterAxisSizing = 'FIXED'
  if (Object.keys(updates).length > 0) graph.updateNode(child.id, updates)

  computeLayout(graph, child.id)

  const restore: Partial<SceneNode> = {}
  if (updates.primaryAxisSizing) restore.primaryAxisSizing = savedPrimary
  if (updates.counterAxisSizing) restore.counterAxisSizing = savedCounter
  if (Object.keys(restore).length > 0) graph.updateNode(child.id, restore)
}

export function applyYogaLayout(
  graph: SceneGraph,
  frame: SceneNode,
  yogaNode: YogaNode,
  computeLayout: ComputeLayoutFn
): void {
  applyFrameSize(graph, frame, yogaNode)

  const children = graph.getChildren(frame.id)
  let yogaIndex = 0
  for (const child of children) {
    if (yogaIndex >= yogaNode.getChildCount()) continue
    const yogaChild = yogaNode.getChild(yogaIndex)
    yogaIndex++

    updateChildFromYoga(graph, child, yogaChild)

    if (child.layoutMode !== 'NONE') {
      if (child.layoutMode === 'GRID' && child.visible && child.layoutPositioning !== 'ABSOLUTE') {
        computeLayout(graph, child.id)
      } else if (
        frame.layoutMode === 'GRID' &&
        child.visible &&
        child.layoutPositioning !== 'ABSOLUTE'
      ) {
        recomputeGridChild(graph, child, computeLayout)
      } else {
        applyYogaLayout(graph, child, yogaChild, computeLayout)
      }
    }
  }
}
