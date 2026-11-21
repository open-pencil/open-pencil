// Figma's preset frames: a frame made from a preset that does not fit the canvas at the current zoom
// is zoomed out to, centered with room around it, rather than left running past the edges.
import type { EditorStore } from '@/app/editor/session'

import type { FramePreset } from './frame-presets'

/** Creates a frame from `preset` at the center of the canvas and brings all of it into view. */
export function createFrameInView(
  store: Pick<EditorStore, 'createFrameFromPreset' | 'revealNodes'>,
  preset: FramePreset
): string {
  const id = store.createFrameFromPreset(preset)
  store.revealNodes([id])
  return id
}
