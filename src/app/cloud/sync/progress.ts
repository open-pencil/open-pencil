import { ref } from 'vue'

/**
 * Per-canvas upload progress (0..1) while a putCanvas job is in flight.
 * Drives the card badge fill on the Cloud Workspace grid.
 */
export const uploadProgressByCanvas = ref<ReadonlyMap<string, number>>(new Map())

export function setUploadProgress(canvasId: string, fraction: number | null) {
  const next = new Map(uploadProgressByCanvas.value)
  if (fraction == null) next.delete(canvasId)
  else next.set(canvasId, Math.max(0, Math.min(1, fraction)))
  uploadProgressByCanvas.value = next
}
