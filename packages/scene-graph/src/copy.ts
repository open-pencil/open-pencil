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
  ArcData,
  ComponentPropertyDefinition,
  Effect,
  FigmaDerivedTextGlyph,
  Fill,
  GeometryPath,
  GradientStop,
  SceneNode,
  Stroke,
  StyleRun
} from './'
import { cloneVectorNetwork } from './vector-network'

// --- Individual copy functions ---

export function copyFill(f: Fill): Fill {
  const copy: Fill = { ...f, color: { ...f.color } }
  if (f.gradientStops) copy.gradientStops = f.gradientStops.map(copyGradientStop)
  if (f.gradientTransform) copy.gradientTransform = { ...f.gradientTransform }
  if (f.imageTransform) copy.imageTransform = { ...f.imageTransform }
  if (f.patternSpacing) copy.patternSpacing = { ...f.patternSpacing }
  if (f.noiseSize) copy.noiseSize = { ...f.noiseSize }
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
  return {
    ...e,
    color: { ...e.color },
    offset: { ...e.offset }
  }
}

export function copyStyleRun(r: StyleRun): StyleRun {
  return {
    ...r,
    style: {
      ...r.style,
      fills: r.style.fills ? r.style.fills.map(copyFill) : undefined,
      textDecorationFills: r.style.textDecorationFills
        ? r.style.textDecorationFills.map(copyFill)
        : undefined,
      fontVariations: r.style.fontVariations
        ? r.style.fontVariations.map((v) => ({ ...v }))
        : undefined,
      fontFeatures: r.style.fontFeatures ? r.style.fontFeatures.map((v) => ({ ...v })) : undefined
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

/**
 * Scale path command blob coordinates by (sx, sy).
 * Identity scale returns a deep copy (same as copyGeometryPaths).
 */
export function scaleGeometryPaths(paths: GeometryPath[], sx: number, sy: number): GeometryPath[] {
  if (sx === 1 && sy === 1) return copyGeometryPaths(paths)
  return paths.map((g) => {
    const scaled = g.commandsBlob.slice()
    const dv = new DataView(scaled.buffer, scaled.byteOffset, scaled.byteLength)
    let offset = 0
    while (offset < scaled.length) {
      const command = scaled[offset++]
      let coords = 0
      if (command === 1 || command === 2) coords = 1
      else if (command === 3)
        coords = 2 // quadTo — glyph-derived blobs use quads
      else if (command === 4) coords = 3
      for (let i = 0; i < coords; i++) {
        dv.setFloat32(offset, dv.getFloat32(offset, true) * sx, true)
        dv.setFloat32(offset + 4, dv.getFloat32(offset + 4, true) * sy, true)
        offset += 8
      }
    }
    return {
      windingRule: g.windingRule,
      commandsBlob: scaled
    }
  })
}

// --- Internal helpers ---

/** Copy an optional array: non-empty → mapped, empty → [], undefined → undefined. */
function copyOpt<T, U>(arr: T[] | undefined, fn: (arr: T[]) => U[]): U[] | undefined {
  if (arr === undefined) return undefined
  return arr.length > 0 ? fn(arr) : []
}

function copyGradientStop(gs: GradientStop): GradientStop {
  return { color: { ...gs.color }, position: gs.position }
}

function copySpread<T extends object>(arr: T[] | undefined): T[] {
  return arr?.map((item) => ({ ...item })) ?? []
}

function copyPropertyDefs(
  defs: ComponentPropertyDefinition[] | undefined
): ComponentPropertyDefinition[] {
  return (
    defs?.map((d) => ({
      ...d,
      variantOptions: d.variantOptions ? [...d.variantOptions] : undefined
    })) ?? []
  )
}

function copyGlyphs(glyphs: FigmaDerivedTextGlyph[] | null): FigmaDerivedTextGlyph[] | null {
  return glyphs ? glyphs.map((g) => ({ ...g, commandsBlob: new Uint8Array(g.commandsBlob) })) : null
}

// --- Complex structure copy functions ---
// These replace structuredClone for known types, avoiding its ~24× overhead.

function copyArcData(a: ArcData): ArcData {
  return { startingAngle: a.startingAngle, endingAngle: a.endingAngle, innerRadius: a.innerRadius }
}

// --- Deep-copy clone props ---

/**
 * Build the init props for a deep-copy clone of `src`.
 * Shares logic between SceneGraph.cloneTree and instance child cloning.
 * Explicitly deep-copies all mutable object/array fields that `...rest`
 * would otherwise share by reference. When adding a mutable SceneNode field,
 * add its copy behavior here or document why sharing is intentional.
 */
export function cloneNodeProps(src: SceneNode, componentId: string | null): Partial<SceneNode> {
  const { id: _, parentId: _p, childIds: _c, ...rest } = src
  return {
    ...rest,
    ...(componentId !== null ? { componentId } : {}),
    boundVariables: { ...src.boundVariables },
    overrides: Object.keys(src.overrides).length > 0 ? structuredClone(src.overrides) : {},
    fills: copyOpt(src.fills, copyFills),
    strokes: copyOpt(src.strokes, copyStrokes),
    effects: copyOpt(src.effects, copyEffects),
    styleRuns: copyOpt(src.styleRuns, copyStyleRuns),
    // Source metadata preserves opaque raw Figma payloads; use structuredClone instead of
    // hand-copying partial known shapes and accidentally sharing nested raw Figma data.
    source: structuredClone(src.source),
    dashPattern: copyOpt(src.dashPattern, (a) => [...a]),
    fontVariations: copyOpt(src.fontVariations, (a) => a.map((v) => ({ ...v }))),
    fontFeatures: copyOpt(src.fontFeatures, (a) => a.map((v) => ({ ...v }))),
    textDecorationFills: copyOpt(src.textDecorationFills, copyFills),
    fillGeometry: copyOpt(src.fillGeometry, copyGeometryPaths),
    strokeGeometry: copyOpt(src.strokeGeometry, copyGeometryPaths),
    gridTemplateColumns: copySpread(src.gridTemplateColumns),
    gridTemplateRows: copySpread(src.gridTemplateRows),
    componentPropertyDefinitions: copyPropertyDefs(src.componentPropertyDefinitions),
    symbolLinks: copySpread(src.symbolLinks),
    variantPropSpecs: copySpread(src.variantPropSpecs),
    pluginData: copySpread(src.pluginData),
    pluginRelaunchData: copySpread(src.pluginRelaunchData),
    exportSettings: copySpread(src.exportSettings),
    componentPropertyValues: { ...src.componentPropertyValues },
    figmaDerivedLayout: src.figmaDerivedLayout ? { ...src.figmaDerivedLayout } : null,
    arcData: src.arcData ? copyArcData(src.arcData) : null,
    vectorNetwork: src.vectorNetwork ? cloneVectorNetwork(src.vectorNetwork) : null,
    textPicture: src.textPicture ? new Uint8Array(src.textPicture) : null,
    figmaDerivedTextGlyphs: copyGlyphs(src.figmaDerivedTextGlyphs),
    gridPosition: src.gridPosition ? { ...src.gridPosition } : null
  }
}
