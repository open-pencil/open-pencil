import type { SceneNode } from '@open-pencil/scene-graph'
import { numberSettings } from '@open-pencil/scene-graph'

import { documentPartFrame } from './parts'
import type { PlayInteraction, PlayPointer } from './types'

/** The value under a canvas x, from the track's position and the thumb's width. */
function valueAt({ graph, target }: Omit<PlayPointer, 'hitId'>, x: number): number | null {
  const settings = numberSettings(target.behaviour, 'value')
  const track = documentPartFrame(graph, target, 'track')
  const thumb = documentPartFrame(graph, target, 'thumb')
  if (!settings || !track) return null
  const start = graph.getAbsolutePosition(track.id).x + (thumb?.width ?? 0) / 2
  const length = Math.max(1, track.width - (thumb?.width ?? 0))
  const ratio = Math.min(1, Math.max(0, (x - start) / length))
  return settings.min + ratio * (settings.max - settings.min)
}

/** Set the value: the thumb moves along the track and the range fills up to it. */
function slide(pointer: Omit<PlayPointer, 'hitId'>): void {
  const { session, target } = pointer
  const requested = valueAt(pointer, pointer.x)
  const settings = numberSettings(target.behaviour, 'value')
  const value = requested === null ? null : session.setNumber(target, 'value', requested)
  if (value === null || !settings) return
  const span = settings.max - settings.min
  const ratio = span > 0 ? (value - settings.min) / span : 0
  session.edit(target, (graph, copy) => {
    const track = session.partFrame(target, copy, 'track')
    const thumb = session.partFrame(target, copy, 'thumb')
    const range = session.partFrame(target, copy, 'range')
    if (!track || !thumb) return
    // The thumb and range sit either inside the track or beside it in the same parent.
    const originOf = (node: SceneNode) => (node.parentId === track.id ? 0 : track.x)
    const travel = Math.max(0, track.width - thumb.width)
    graph.updateNode(thumb.id, { x: originOf(thumb) + ratio * travel })
    if (range)
      graph.updateNode(range.id, {
        x: originOf(range),
        width: Math.max(0, ratio * travel + thumb.width / 2)
      })
  })
}

/** Slider: a press jumps to the pointer, and dragging follows it. */
export const slider: PlayInteraction = {
  press(pointer) {
    slide(pointer)
    return true
  },
  drag: slide
}
