import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { copyFills, copyStrokes, copyEffects, copyStyleRuns } from '@open-pencil/scene-graph/copy'

import type { ProtectionMap, ProtectedField } from '#core/kiwi/fig/instance-overrides/patches'
import { isFieldProtected } from '#core/kiwi/fig/instance-overrides/patches'

function canSync(
  protections: ProtectionMap | undefined,
  targetId: string,
  field: ProtectedField
): boolean {
  return !isFieldProtected(protections, targetId, field)
}

type SyncFn = (
  source: SceneNode,
  target: SceneNode,
  updates: Partial<SceneNode>,
  protections?: ProtectionMap
) => void

type DirectSyncKey = 'text' | 'visible' | 'opacity' | 'locked' | 'layoutGrow' | 'textAutoResize'
type CopiedSyncKey = 'fills' | 'strokes' | 'effects' | 'styleRuns'

function assignDirectUpdate(
  key: DirectSyncKey,
  source: SceneNode,
  updates: Partial<SceneNode>
): void {
  switch (key) {
    case 'text':
      updates.text = source.text
      break
    case 'visible':
      updates.visible = source.visible
      break
    case 'opacity':
      updates.opacity = source.opacity
      break
    case 'locked':
      updates.locked = source.locked
      break
    case 'layoutGrow':
      updates.layoutGrow = source.layoutGrow
      break
    case 'textAutoResize':
      updates.textAutoResize = source.textAutoResize
      break
  }
}

function directSync(key: DirectSyncKey, field: ProtectedField): SyncFn {
  return (source, target, updates, protections) => {
    if (source[key] !== target[key] && canSync(protections, target.id, field)) {
      assignDirectUpdate(key, source, updates)
    }
  }
}

const DIRECT_SYNCERS: SyncFn[] = [
  directSync('text', 'text'),
  directSync('visible', 'visible'),
  directSync('opacity', 'opacity'),
  directSync('locked', 'locked'),
  directSync('layoutGrow', 'layoutGrow'),
  directSync('textAutoResize', 'textAutoResize')
]

function assignCopiedUpdate(
  key: CopiedSyncKey,
  source: SceneNode,
  updates: Partial<SceneNode>
): void {
  switch (key) {
    case 'fills':
      updates.fills = copyFills(source.fills)
      break
    case 'strokes':
      updates.strokes = copyStrokes(source.strokes)
      break
    case 'effects':
      updates.effects = copyEffects(source.effects)
      break
    case 'styleRuns':
      updates.styleRuns = copyStyleRuns(source.styleRuns)
      break
  }
}

function copiedSync(key: CopiedSyncKey, field: ProtectedField): SyncFn {
  return (source, target, updates, protections) => {
    if (source[key] !== target[key] && canSync(protections, target.id, field)) {
      assignCopiedUpdate(key, source, updates)
    }
  }
}

const COPIED_SYNCERS: SyncFn[] = [
  copiedSync('fills', 'fills'),
  copiedSync('strokes', 'strokes'),
  copiedSync('effects', 'effects'),
  copiedSync('styleRuns', 'styleRuns')
]

function syncFields(
  source: SceneNode,
  target: SceneNode,
  updates: Partial<SceneNode>,
  protections?: ProtectionMap
): void {
  for (const sync of DIRECT_SYNCERS) sync(source, target, updates, protections)
  for (const sync of COPIED_SYNCERS) sync(source, target, updates, protections)
}

export function syncNodeProps(
  graph: SceneGraph,
  source: SceneNode,
  target: SceneNode,
  protections?: ProtectionMap
): void {
  const updates: Partial<SceneNode> = {}
  syncFields(source, target, updates, protections)
  if (Object.keys(updates).length > 0) graph.updateNode(target.id, updates)
}
