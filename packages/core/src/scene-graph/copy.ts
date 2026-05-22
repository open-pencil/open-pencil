/**
 * Typed shallow-copy helpers for Fill, Stroke, Effect, and StyleRun.
 *
 * These replace `structuredClone` for known scene-graph array types,
 * avoiding the ~24× overhead of the generic deep-clone algorithm.
 * Each helper spreads the top-level object and any nested objects
 * (color, offset, gradientStops, dashPattern, style) to ensure
 * no shared references between source and copy.
 */

import type {
  BlurEffect,
  Effect,
  Fill,
  GeometryPath,
  GradientFill,
  GradientStop,
  ImageFill,
  ShadowEffect,
  SolidFill,
  Stroke,
  StyleRun
} from './'

// --- Individual copy functions ---

export function copyFill(f: Fill): Fill {
  if (f.type === 'SOLID') return copySolidFill(f)
  if (f.type === 'IMAGE') return copyImageFill(f)
  return copyGradientFill(f)
}

function copySolidFill(f: SolidFill): SolidFill {
  return { ...f, color: { ...f.color } }
}

function copyGradientFill(f: GradientFill): GradientFill {
  return {
    ...f,
    gradientStops: f.gradientStops.map(copyGradientStop),
    gradientTransform: { ...f.gradientTransform }
  }
}

function copyImageFill(f: ImageFill): ImageFill {
  const copy: ImageFill = { ...f }
  if (f.imageTransform) copy.imageTransform = { ...f.imageTransform }
  return copy
}

export function copyStroke(s: Stroke): Stroke {
  const copy: Stroke = { ...s, color: { ...s.color } }
  if (s.dashPattern) {
    copy.dashPattern = [...s.dashPattern]
  }
  return copy
}

export function copyEffect(e: Effect): Effect {
  if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') return copyShadowEffect(e)
  return copyBlurEffect(e as BlurEffect)
}

function copyShadowEffect(e: ShadowEffect): ShadowEffect {
  return { ...e, color: { ...e.color }, offset: { ...e.offset } }
}

function copyBlurEffect(e: BlurEffect): BlurEffect {
  return { ...e }
}

export function copyStyleRun(r: StyleRun): StyleRun {
  return {
    ...r,
    style: {
      ...r.style,
      fills: r.style.fills ? r.style.fills.map(copyFill) : undefined
    }
  }
}

// --- Array copy functions ---

export function copyFills(fills: Fill[]): Fill[] {
  return fills.map(copyFill)
}

export function copyStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map(copyStroke)
}

export function copyEffects(effects: Effect[]): Effect[] {
  return effects.map(copyEffect)
}

export function copyStyleRuns(runs: StyleRun[]): StyleRun[] {
  return runs.map(copyStyleRun)
}

export function copyGeometryPaths(paths: GeometryPath[]): GeometryPath[] {
  return paths.map((p) => ({
    windingRule: p.windingRule,
    commandsBlob: p.commandsBlob.slice()
  }))
}

// --- Internal helpers ---

function copyGradientStop(gs: GradientStop): GradientStop {
  return { color: { ...gs.color }, position: gs.position }
}
