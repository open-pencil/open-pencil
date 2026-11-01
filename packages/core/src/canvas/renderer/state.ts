import type { SkPicture } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { changesShaping } from '#core/canvas/text/paragraph/inputs'

export interface NodeFlash {
  nodeId: string
  startTime: number
}

/** Layers flashing for attention, and those the AI is working on or has just finished. */
export interface FeedbackMarks {
  readonly flashes: NodeFlash[]
  readonly aiActive: Set<string>
  readonly aiDone: NodeFlash[]
}

export function createFeedbackMarks(): FeedbackMarks {
  return { flashes: [], aiActive: new Set(), aiDone: [] }
}

/** A node's picture of itself with its effects, good while the font generation holds. */
export interface NodePictureEntry {
  picture: SkPicture
  fontGeneration: number
}

/** The whole page in one picture, with what it was recorded for; stale when any of those moved. */
export interface WholeScenePicture {
  picture: SkPicture | null
  version: number
  fontGeneration: number
  positionPreviewVersion: number
  pageId: string | null
}

export function createWholeScenePicture(): WholeScenePicture {
  return {
    picture: null,
    version: -1,
    fontGeneration: -1,
    positionPreviewVersion: -1,
    pageId: null
  }
}

export function invalidateScenePicture(r: SkiaRenderer): void {
  r.wholeScene.picture?.delete()
  r.wholeScene.picture = null
  r.wholeScene.version = -1
  r.wholeScene.fontGeneration = -1
}

export function clearNodePictures(r: Pick<SkiaRenderer, 'nodePictures'>): void {
  for (const { picture } of r.nodePictures.values()) picture.delete()
  r.nodePictures.clear()
}

export function invalidateAllPictures(r: SkiaRenderer): void {
  r.textPreparationCache.clear()
  r.textFonts.readiness.clear()
  invalidateScenePicture(r)
  r.tiledScene.invalidateStructure()
  clearNodePictures(r)
}

export function invalidateNodePicture(
  r: SkiaRenderer,
  nodeId: string,
  changedKeys?: readonly (keyof SceneNode)[]
): void {
  r.textPreparationCache.deleteNode(nodeId, {
    keepShaping: changedKeys !== undefined && !changesShaping(changedKeys)
  })
  r.textFonts.readiness.delete(nodeId)
  const cached = r.nodePictures.get(nodeId)
  if (cached) {
    cached.picture.delete()
    r.nodePictures.delete(nodeId)
  }
}

export function flashNode(r: SkiaRenderer, nodeId: string): void {
  r.feedback.flashes.push({ nodeId, startTime: performance.now() })
}

export function aiMarkActive(r: SkiaRenderer, nodeIds: string[]): void {
  for (const id of nodeIds) r.feedback.aiActive.add(id)
}

export function aiMarkDone(r: SkiaRenderer, nodeIds: string[]): void {
  const now = performance.now()
  for (const id of nodeIds) {
    if (r.feedback.aiActive.delete(id)) {
      r.feedback.aiDone.push({ nodeId: id, startTime: now })
    }
  }
}

export function aiFlashDone(r: SkiaRenderer, nodeIds: string[]): void {
  const now = performance.now()
  for (const id of nodeIds) {
    r.feedback.aiDone.push({ nodeId: id, startTime: now })
  }
}

export function aiClearActive(r: SkiaRenderer): void {
  r.feedback.aiActive.clear()
}

export function aiClearAll(r: SkiaRenderer): void {
  r.feedback.aiActive.clear()
  r.feedback.aiDone.length = 0
}

export function hasActiveFlashes(r: SkiaRenderer): boolean {
  return (
    r.feedback.flashes.length > 0 || r.feedback.aiActive.size > 0 || r.feedback.aiDone.length > 0
  )
}
