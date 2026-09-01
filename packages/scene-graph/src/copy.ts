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
  DerivedTextGlyph,
  Fill,
  GeometryPath,
  GradientStop,
  LayoutGrid,
  SceneNode,
  Stroke,
  StyleRun
} from './'
import { geometryCommandCoordCount } from './geometry'
import { cloneInstanceOverrideState } from './instance-overrides'
import { createDefaultSourceMetadata } from './node-defaults'
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

const internalCopySources = new WeakMap<object, object>()

/** Record immutable lineage for an internal deep copy without sharing mutable values. */
export function markCopySource<T extends object>(source: T, copy: T): T {
  internalCopySources.set(copy, internalCopySources.get(source) ?? source)
  return copy
}

/** Compare internal deep copies in O(1) without traversing large paint or text payloads. */
export function hasSameCopySource(left: object, right: object): boolean {
  if (left === right) return true
  return (internalCopySources.get(left) ?? left) === (internalCopySources.get(right) ?? right)
}

export function copyFills(fills: Fill[]): Fill[] {
  return fills.map(copyFill)
}

export function copyStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map(copyStroke)
}

export function copyEffects(effects: Effect[]): Effect[] {
  return effects.map(copyEffect)
}

export function copyLayoutGrids(grids: LayoutGrid[]): LayoutGrid[] {
  return grids.map((grid) => ({ ...grid, color: grid.color ? { ...grid.color } : undefined }))
}

export function copyStyleRuns(runs: StyleRun[]): StyleRun[] {
  return runs.map(copyStyleRun)
}

/** Keep path-level fills across copy/scale/transform (resize snapshots). */
function withPathPaintMeta(path: GeometryPath, commandsBlob: Uint8Array): GeometryPath {
  return {
    windingRule: path.windingRule,
    commandsBlob,
    ...(path.fills ? { fills: copyFills(path.fills) } : {})
  }
}

export function copyGeometryPaths(paths: GeometryPath[]): GeometryPath[] {
  return paths.map((p) => withPathPaintMeta(p, p.commandsBlob.slice()))
}

/**
 * Affine-transform every coordinate pair in a path command blob (returns a
 * copy): (x, y) → (m00·x + m01·y + tx, m10·x + m11·y + ty).
 * Command layout: 1=move/2=line (1 pair), 3=quad (2 pairs), 4=cubic (3 pairs)
 * — font-glyph blobs are quad-heavy, so skipping command 3 desyncs the walk.
 */
export function transformGeometryBlob(
  blob: Uint8Array,
  m00: number,
  m01: number,
  m10: number,
  m11: number,
  tx = 0,
  ty = 0
): Uint8Array {
  const out = blob.slice()
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength)
  let offset = 0
  while (offset < out.length) {
    const command = out[offset++]
    const coords = geometryCommandCoordCount(command)
    if (coords == null) break
    for (let i = 0; i < coords; i++) {
      if (offset + 8 > out.length) break
      const x = dv.getFloat32(offset, true)
      const y = dv.getFloat32(offset + 4, true)
      dv.setFloat32(offset, m00 * x + m01 * y + tx, true)
      dv.setFloat32(offset + 4, m10 * x + m11 * y + ty, true)
      offset += 8
    }
  }
  return out
}

export function transformGeometryPaths(
  paths: GeometryPath[],
  m00: number,
  m01: number,
  m10: number,
  m11: number,
  tx = 0,
  ty = 0
): GeometryPath[] {
  return paths.map((g) =>
    withPathPaintMeta(g, transformGeometryBlob(g.commandsBlob, m00, m01, m10, m11, tx, ty))
  )
}

/**
 * Scale path command blob coordinates by (sx, sy).
 * Identity scale returns a deep copy (same as copyGeometryPaths).
 */
export function scaleGeometryPaths(paths: GeometryPath[], sx: number, sy: number): GeometryPath[] {
  if (sx === 1 && sy === 1) return copyGeometryPaths(paths)
  return transformGeometryPaths(paths, sx, 0, 0, sy)
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
      variantOptions: d.variantOptions ? [...d.variantOptions] : undefined,
      preferredValues: d.preferredValues ? [...d.preferredValues] : undefined
    })) ?? []
  )
}

/** Deep-copy path-text glyphs (fresh commandsBlob buffers). */
export function copyDerivedGlyphs(glyphs: DerivedTextGlyph[] | null): DerivedTextGlyph[] | null {
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
export type NodeCloneMode = 'deep' | 'fig-import'

export function cloneNodeProps(
  src: SceneNode,
  componentId: string | null,
  mode: NodeCloneMode = 'deep'
): Partial<SceneNode> {
  const { id: _, parentId: _p, childIds: _c, ...rest } = src
  if (mode === 'fig-import') {
    return {
      ...rest,
      ...(componentId !== null ? { componentId } : {}),
      source: createDefaultSourceMetadata(),
      boundVariables: { ...src.boundVariables },
      variableModes: { ...src.variableModes },
      instanceOverrides: cloneInstanceOverrideState(src.instanceOverrides),
      componentPropertyAssignments: { ...src.componentPropertyAssignments },

      componentPropertyValues: { ...src.componentPropertyValues }
    }
  }
  return {
    ...rest,
    ...(componentId !== null ? { componentId } : {}),
    boundVariables: { ...src.boundVariables },
    variableModes: { ...src.variableModes },
    instanceOverrides: cloneInstanceOverrideState(src.instanceOverrides),
    fills: copyOpt(src.fills, (value) => markCopySource(value, copyFills(value))),

    strokes: copyOpt(src.strokes, (value) => markCopySource(value, copyStrokes(value))),
    effects: copyOpt(src.effects, (value) => markCopySource(value, copyEffects(value))),
    layoutGrids: copyOpt(src.layoutGrids, copyLayoutGrids),
    guides: copyOpt(src.guides, (guides) => guides.map((guide) => ({ ...guide }))),
    styleRuns: copyOpt(src.styleRuns, (value) => markCopySource(value, copyStyleRuns(value))),
    // Generated instance descendants have no independent Figma provenance. Retaining the source
    // component's opaque raw payload here duplicates megabytes of metadata per instance.
    source: componentId === null ? structuredClone(src.source) : createDefaultSourceMetadata(),
    dashPattern: copyOpt(src.dashPattern, (a) => [...a]),
    fontVariations: copyOpt(src.fontVariations, (a) => a.map((v) => ({ ...v }))),
    fontFeatures: copyOpt(src.fontFeatures, (a) => a.map((v) => ({ ...v }))),
    textDecorationFills: copyOpt(src.textDecorationFills, copyFills),
    fillGeometry: copyOpt(src.fillGeometry, copyGeometryPaths),
    strokeGeometry: copyOpt(src.strokeGeometry, copyGeometryPaths),
    gridTemplateColumns: copySpread(src.gridTemplateColumns),
    gridTemplateRows: copySpread(src.gridTemplateRows),
    componentPropertyDefinitions: copyPropertyDefs(src.componentPropertyDefinitions),
    componentPropertyReferences: copySpread(src.componentPropertyReferences),
    componentPropertyAssignments: { ...src.componentPropertyAssignments },
    symbolLinks: copySpread(src.symbolLinks),
    variantPropSpecs: copySpread(src.variantPropSpecs),
    pluginData: copySpread(src.pluginData),
    pluginRelaunchData: copySpread(src.pluginRelaunchData),
    exportSettings: copySpread(src.exportSettings),
    componentPropertyValues: { ...src.componentPropertyValues },
    derivedLayout: src.derivedLayout ? { ...src.derivedLayout } : null,
    arcData: src.arcData ? copyArcData(src.arcData) : null,
    vectorNetwork: src.vectorNetwork ? cloneVectorNetwork(src.vectorNetwork) : null,
    textPicture: src.textPicture ? new Uint8Array(src.textPicture) : null,
    derivedTextGlyphs: src.derivedTextGlyphs
      ? markCopySource(src.derivedTextGlyphs, copyDerivedGlyphs(src.derivedTextGlyphs) ?? [])
      : null,
    textPathData: src.textPathData ? structuredClone(src.textPathData) : null,
    textPathBox: src.textPathBox ? { ...src.textPathBox } : null,
    gridPosition: src.gridPosition ? { ...src.gridPosition } : null
  }
}
