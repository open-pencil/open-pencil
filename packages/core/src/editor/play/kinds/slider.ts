import { numberSettings, type SceneNode } from '@open-pencil/scene-graph'

import { documentPartFrame } from './parts'
import type { PlayControl, PlayInteraction, PlayKey, PlayPointer } from './types'

/** The value under a canvas x, from the track's position and the thumb's width. */
function valueAt({ graph, target }: PlayControl, x: number): number | null {
  const settings = numberSettings(target.behaviour, 'value')
  const track = documentPartFrame(graph, target, 'track')
  const thumb = documentPartFrame(graph, target, 'thumb')
  if (!settings || !track) return null
  const start = graph.getAbsolutePosition(track.id).x + (thumb?.width ?? 0) / 2
  const length = Math.max(1, track.width - (thumb?.width ?? 0))
  const ratio = Math.min(1, Math.max(0, (x - start) / length))
  return settings.min + ratio * (settings.max - settings.min)
}

/** Draw a value: the thumb moves along the track and the range fills up to it. */
function draw({ session, target }: PlayControl, value: number): void {
  const settings = numberSettings(target.behaviour, 'value')
  if (!settings) return
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

function set(control: PlayControl, requested: number): void {
  const value = control.session.setNumber(control.target, 'value', requested)
  if (value !== null) draw(control, value)
}

function slide(pointer: Omit<PlayPointer, 'hitId'>): void {
  const value = valueAt(pointer, pointer.x)
  if (value !== null) set(pointer, value)
}

/** Arrows step the value, by ten steps with Shift; Home and End go to the ends. */
function step(control: PlayKey): boolean {
  const settings = numberSettings(control.target.behaviour, 'value')
  if (!settings) return false
  const current = control.session.getNumber(control.target, 'value')
  const by =
    (settings.step > 0 ? settings.step : (settings.max - settings.min) / 100) *
    (control.shift ? 10 : 1)
  const next = {
    ArrowRight: current + by,
    ArrowUp: current + by,
    ArrowLeft: current - by,
    ArrowDown: current - by,
    Home: settings.min,
    End: settings.max
  }[control.key as string]
  if (next === undefined) return false
  set(control, next)
  return true
}

/** Slider: a press jumps to the pointer, dragging follows it, and arrows step it. */
export const slider: PlayInteraction = {
  press(pointer) {
    slide(pointer)
    return true
  },
  drag: slide,
  key: step,
  restore(control) {
    const value = control.session.changed(control.target, 'value')
    if (value !== undefined) draw(control, value)
  }
}
