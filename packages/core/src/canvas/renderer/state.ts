import type { SkiaRenderer } from '#core/canvas/renderer'

function clearStrokePathCaches(r: SkiaRenderer): void {
  r.vectorStrokePathCache.clear()
  r.vectorStrokeOutlineCache.clear()
}

export function invalidateScenePicture(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.scenePicture = null
  r.scenePictureVersion = -1
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
  clearSubtreePictureCache(r)
  r._scenePictureAnimating = false
}

export function clearSubtreePictureCache(r: SkiaRenderer): void {
  for (const entry of r.subtreePictureCache.values()) entry.picture.delete()
  r.subtreePictureCache.clear()
  r.subtreePictureCachePageId = null
  r.subtreePictureCacheSceneVersion = -1
  r.subtreePictureCachePositionPreviewVersion = -1
}

export function invalidateAllPictures(r: SkiaRenderer): void {
  invalidateScenePicture(r)
  r.nodePictureCache.clear()
  clearStrokePathCaches(r)
  r._absPosFullCache.clear()
  r._absPosFullSceneVersion = -1
  r._absPosFullPageId = r.pageId
}

export function invalidateNodePicture(r: SkiaRenderer, nodeId: string): void {
  r.nodePictureCache.delete(nodeId)
  // Invalidate stroke path cache for this node — vector network
  // or stroke property changes render old cached paths stale.
  r.vectorStrokePathCache.delete(nodeId)
  // Outline cache keys are composite (nodeId|weight|cap|join) —
  // clear all entries whose key starts with this node's ID.
  for (const key of r.vectorStrokeOutlineCache.keys()) {
    if (key.startsWith(nodeId)) r.vectorStrokeOutlineCache.delete(key)
  }
  // Clear all subtree pictures — a descendant change may have invalidated
  // a top-level page child's subtree picture that includes this node.
  // We can't cheaply map from a descendant to its top-level page child,
  // so clearing the entire cache is the conservative correct choice.
  clearSubtreePictureCache(r)
}

export function flashNode(r: SkiaRenderer, nodeId: string): void {
  r._flashes.push({ nodeId, startTime: performance.now() })
}

export function aiMarkActive(r: SkiaRenderer, nodeIds: string[]): void {
  for (const id of nodeIds) r._aiActiveNodes.add(id)
}

export function aiMarkDone(r: SkiaRenderer, nodeIds: string[]): void {
  const now = performance.now()
  for (const id of nodeIds) {
    if (r._aiActiveNodes.delete(id)) {
      r._aiDoneFlashes.push({ nodeId: id, startTime: now })
    }
  }
}

export function aiFlashDone(r: SkiaRenderer, nodeIds: string[]): void {
  const now = performance.now()
  for (const id of nodeIds) {
    r._aiDoneFlashes.push({ nodeId: id, startTime: now })
  }
}

export function aiClearActive(r: SkiaRenderer): void {
  r._aiActiveNodes.clear()
}

export function aiClearAll(r: SkiaRenderer): void {
  r._aiActiveNodes.clear()
  r._aiDoneFlashes = []
}

export function hasActiveFlashes(r: SkiaRenderer): boolean {
  return r._flashes.length > 0 || r._aiActiveNodes.size > 0 || r._aiDoneFlashes.length > 0
}
