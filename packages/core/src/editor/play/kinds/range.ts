import { numberSettings } from '@open-pencil/scene-graph'

import { documentPartFrame } from './parts'
import type { PlayControl, PlayInteraction, PlayKey, PlayPointer } from './types'

/** Draws a number value as a ratio of its range, from 0 at the minimum to 1 at the maximum. */
export type DrawRatio = (control: PlayControl, ratio: number) => void

/**
 * A control holding a number on a track, like a slider or a progress bar: a press jumps to the
 * pointer, dragging follows it, arrows step it (ten steps with Shift), and Home and End go to
 * the ends. `thumb`, when the control has one, keeps its centre within the track.
 */
export function rangeControl(draw: DrawRatio, thumb?: string): PlayInteraction {
  function valueAt({ graph, target }: PlayControl, x: number): number | null {
    const settings = numberSettings(target.behaviour, 'value')
    const track = documentPartFrame(graph, target, 'track')
    const thumbWidth = (thumb && documentPartFrame(graph, target, thumb)?.width) || 0
    if (!settings || !track) return null
    const start = graph.getAbsolutePosition(track.id).x + thumbWidth / 2
    const length = Math.max(1, track.width - thumbWidth)
    const ratio = Math.min(1, Math.max(0, (x - start) / length))
    return settings.min + ratio * (settings.max - settings.min)
  }

  function show(control: PlayControl, value: number): void {
    const settings = numberSettings(control.target.behaviour, 'value')
    if (!settings) return
    const span = settings.max - settings.min
    draw(control, span > 0 ? (value - settings.min) / span : 0)
  }

  function set(control: PlayControl, requested: number): void {
    const value = control.session.setNumber(control.target, 'value', requested)
    if (value !== null) show(control, value)
  }

  function slide(pointer: Omit<PlayPointer, 'hitId'>): void {
    const value = valueAt(pointer, pointer.x)
    if (value !== null) set(pointer, value)
  }

  function step(control: PlayKey): boolean {
    const settings = numberSettings(control.target.behaviour, 'value')
    if (!settings) return false
    const current = control.session.getNumber(control.target, 'value')
    const by =
      (settings.step > 0 ? settings.step : (settings.max - settings.min) / 100) *
      (control.shift ? 10 : 1)
    const next: Partial<Record<PlayKey['key'], number>> = {
      ArrowRight: current + by,
      ArrowUp: current + by,
      ArrowLeft: current - by,
      ArrowDown: current - by,
      Home: settings.min,
      End: settings.max
    }
    const value = next[control.key]
    if (value === undefined) return false
    set(control, value)
    return true
  }

  return {
    press(pointer) {
      slide(pointer)
      return true
    },
    drag: slide,
    key: step,
    restore(control) {
      const value = control.session.changed(control.target, 'value')
      if (value !== undefined) show(control, value)
    }
  }
}
