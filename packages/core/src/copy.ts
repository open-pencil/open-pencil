/**
 * Typed deep copy helpers for scene node array props.
 * Replaces structuredClone in hot paths (instance-overrides syncNodeProps, scene-graph copyProp)
 * for predictable, cheaper copies while preserving correctness.
 */

import type { Fill, Stroke, Effect, StyleRun, GradientStop } from './scene-graph'

function copyColor(c: { r: number; g: number; b: number; a: number }) {
  return { r: c.r, g: c.g, b: c.b, a: c.a }
}

function copyGradientStop(s: GradientStop): GradientStop {
  return { color: copyColor(s.color), position: s.position }
}

export function copyFills(fills: Fill[]): Fill[] {
  return fills.map((f) => {
    const copy: Fill = {
      type: f.type,
      color: copyColor(f.color),
      opacity: f.opacity,
      visible: f.visible
    }
    if (f.blendMode !== undefined) copy.blendMode = f.blendMode
    if (f.gradientStops?.length) {
      copy.gradientStops = f.gradientStops.map(copyGradientStop)
    }
    if (f.gradientTransform)
      copy.gradientTransform = {
        m00: f.gradientTransform.m00,
        m01: f.gradientTransform.m01,
        m02: f.gradientTransform.m02,
        m10: f.gradientTransform.m10,
        m11: f.gradientTransform.m11,
        m12: f.gradientTransform.m12
      }
    if (f.imageHash !== undefined) copy.imageHash = f.imageHash
    if (f.imageScaleMode !== undefined) copy.imageScaleMode = f.imageScaleMode
    if (f.imageTransform)
      copy.imageTransform = {
        m00: f.imageTransform.m00,
        m01: f.imageTransform.m01,
        m02: f.imageTransform.m02,
        m10: f.imageTransform.m10,
        m11: f.imageTransform.m11,
        m12: f.imageTransform.m12
      }
    return copy
  })
}

export function copyStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => {
    const copy: Stroke = {
      color: copyColor(s.color),
      weight: s.weight,
      opacity: s.opacity,
      visible: s.visible,
      align: s.align
    }
    if (s.cap !== undefined) copy.cap = s.cap
    if (s.join !== undefined) copy.join = s.join
    if (s.dashPattern?.length) copy.dashPattern = [...s.dashPattern]
    return copy
  })
}

export function copyEffects(effects: Effect[]): Effect[] {
  return effects.map((e) => ({
    type: e.type,
    color: copyColor(e.color),
    offset: { x: e.offset.x, y: e.offset.y },
    radius: e.radius,
    spread: e.spread,
    visible: e.visible,
    ...(e.blendMode !== undefined && { blendMode: e.blendMode })
  }))
}

export function copyStyleRuns(runs: StyleRun[]): StyleRun[] {
  return runs.map((r) => ({
    start: r.start,
    length: r.length,
    style: { ...r.style }
  }))
}
