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
    overrides: structuredClone(src.overrides),
    fills: copyFills(src.fills),
    strokes: copyStrokes(src.strokes),
    effects: copyEffects(src.effects),
    styleRuns: src.styleRuns.length > 0 ? copyStyleRuns(src.styleRuns) : [],
    source: structuredClone(src.source),
    dashPattern: [...src.dashPattern],
    fontVariations: src.fontVariations.map((v) => ({ ...v })),
    fontFeatures: src.fontFeatures.map((v) => ({ ...v })),
    textDecorationFills: copyFills(src.textDecorationFills),
    fillGeometry: copyGeometryPaths(src.fillGeometry),
    strokeGeometry: copyGeometryPaths(src.strokeGeometry),
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
    arcData: src.arcData ? structuredClone(src.arcData) : null,
    vectorNetwork: src.vectorNetwork ? structuredClone(src.vectorNetwork) : null,
    textPicture: src.textPicture ? new Uint8Array(src.textPicture) : null,
    figmaDerivedTextGlyphs: copyGlyphs(src.figmaDerivedTextGlyphs),
    gridPosition: src.gridPosition ? { ...src.gridPosition } : null
  }
}
