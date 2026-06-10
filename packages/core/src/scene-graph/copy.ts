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
  SourceMetadata,
  Stroke,
  StyleRun,
  VectorNetwork
} from './'

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

// --- Internal helpers ---

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

/** Shallow-copy an unknown[] where object items are spread-copied. */
function copyUnknownArray(arr: unknown[]): unknown[] {
  return arr.map((item) => (typeof item === 'object' && item !== null ? { ...item } : item))
}

function copySource(src: SourceMetadata): SourceMetadata {
  return {
    format: src.format,
    id: src.id,
    orderKey: src.orderKey,
    fig: {
      rawSize: src.fig.rawSize ? { ...src.fig.rawSize } : null,
      rawTransform: src.fig.rawTransform ? { ...src.fig.rawTransform } : null,
      rawNodeFields: { ...src.fig.rawNodeFields },
      layout: src.fig.layout ? { ...src.fig.layout } : null,
      symbolOverrides: copyUnknownArray(src.fig.symbolOverrides),
      componentPropAssignments: copyUnknownArray(src.fig.componentPropAssignments),
      derivedSymbolData: copyUnknownArray(src.fig.derivedSymbolData),
      derivedSymbolDataLayoutVersion: src.fig.derivedSymbolDataLayoutVersion,
      uniformScaleFactor: src.fig.uniformScaleFactor
    }
  }
}

function copyArcData(a: ArcData): ArcData {
  return { startingAngle: a.startingAngle, endingAngle: a.endingAngle, innerRadius: a.innerRadius }
}

function copyVectorNetwork(vn: VectorNetwork): VectorNetwork {
  return {
    vertices: vn.vertices.map((vt) => ({ ...vt })),
    segments: vn.segments.map((seg) => ({
      start: seg.start,
      end: seg.end,
      tangentStart: { ...seg.tangentStart },
      tangentEnd: { ...seg.tangentEnd }
    })),
    regions: vn.regions.map((r) => ({ windingRule: r.windingRule, loops: r.loops.map((l) => [...l]) }))
  }
}

// --- Deep-copy clone props ---

/**
 * Build the init props for a deep-copy clone of `src`.
 * Shares logic between SceneGraph.cloneTree and instance child cloning.
 * Explicitly deep-copies all mutable object/array fields that `...rest`
 * would otherwise share by reference.
 */
export function cloneNodeProps(src: SceneNode, componentId: string | null): Partial<SceneNode> {
  const { id: _, parentId: _p, childIds: _c, ...rest } = src
  return {
    ...rest,
    ...(componentId !== null ? { componentId } : {}),
    boundVariables: { ...src.boundVariables },
    overrides: Object.keys(src.overrides).length > 0 ? structuredClone(src.overrides) : {},
    fills: src.fills.length > 0 ? copyFills(src.fills) : [],
    strokes: src.strokes.length > 0 ? copyStrokes(src.strokes) : [],
    effects: src.effects.length > 0 ? copyEffects(src.effects) : [],
    styleRuns: src.styleRuns.length > 0 ? copyStyleRuns(src.styleRuns) : [],
    source: copySource(src.source),
    dashPattern: src.dashPattern.length > 0 ? [...src.dashPattern] : [],
    fontVariations: src.fontVariations.length > 0 ? src.fontVariations.map((v) => ({ ...v })) : [],
    fontFeatures: src.fontFeatures.length > 0 ? src.fontFeatures.map((v) => ({ ...v })) : [],
    textDecorationFills: src.textDecorationFills.length > 0 ? copyFills(src.textDecorationFills) : [],
    fillGeometry: src.fillGeometry.length > 0 ? copyGeometryPaths(src.fillGeometry) : [],
    strokeGeometry: src.strokeGeometry.length > 0 ? copyGeometryPaths(src.strokeGeometry) : [],
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
    vectorNetwork: src.vectorNetwork ? copyVectorNetwork(src.vectorNetwork) : null,
    textPicture: src.textPicture ? new Uint8Array(src.textPicture) : null,
    figmaDerivedTextGlyphs: copyGlyphs(src.figmaDerivedTextGlyphs),
    gridPosition: src.gridPosition ? { ...src.gridPosition } : null
  }
}
