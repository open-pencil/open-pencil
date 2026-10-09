import { scaleGeometryPaths } from '../copy'
import {
  type Effect,
  type Fill,
  type GridTrack,
  type LayoutGrid,
  type SceneNode,
  type Stroke,
  type StyleRun
} from '../types'
import { cloneVectorNetwork } from '../vector-network'

function scaledOptional(value: number | null, scale: number): number | null {
  return value == null ? null : value * scale
}

function scaledStrokes(strokes: readonly Stroke[], scale: number): Stroke[] {
  return strokes.map((stroke) => ({
    ...structuredClone(stroke),
    weight: stroke.weight * scale,
    dashPattern: stroke.dashPattern?.map((value) => value * scale)
  }))
}

function scaledEffects(effects: readonly Effect[], scale: number): Effect[] {
  return effects.map((effect) => ({
    ...structuredClone(effect),
    offset: { x: effect.offset.x * scale, y: effect.offset.y * scale },
    radius: effect.radius * scale,
    spread: effect.spread * scale
  }))
}

function scaledFills(fills: readonly Fill[], scale: number): Fill[] {
  return fills.map((fill) => ({
    ...structuredClone(fill),
    scale: fill.scale == null ? undefined : fill.scale * scale,
    spacing: fill.spacing == null ? undefined : fill.spacing * scale,
    patternSpacing: fill.patternSpacing
      ? { x: fill.patternSpacing.x * scale, y: fill.patternSpacing.y * scale }
      : undefined,
    noiseSize: fill.noiseSize
      ? { x: fill.noiseSize.x * scale, y: fill.noiseSize.y * scale }
      : undefined
  }))
}

function scaledStyleRuns(styleRuns: readonly StyleRun[], scale: number): StyleRun[] {
  return styleRuns.map((run) => ({
    ...structuredClone(run),
    style: {
      ...structuredClone(run.style),
      fontSize: run.style.fontSize == null ? undefined : run.style.fontSize * scale,
      letterSpacing: run.style.letterSpacing == null ? undefined : run.style.letterSpacing * scale,
      lineHeight: scaledOptional(run.style.lineHeight ?? null, scale),
      textDecorationThickness: scaledOptional(run.style.textDecorationThickness ?? null, scale),
      textUnderlineOffset: scaledOptional(run.style.textUnderlineOffset ?? null, scale)
    }
  }))
}

function scaledLayoutGrids(grids: readonly LayoutGrid[], scale: number): LayoutGrid[] {
  return grids.map((grid) => ({
    ...structuredClone(grid),
    offset: grid.offset == null ? undefined : grid.offset * scale,
    sectionSize: grid.sectionSize == null ? undefined : grid.sectionSize * scale,
    gutterSize: grid.gutterSize == null ? undefined : grid.gutterSize * scale
  }))
}

function scaledGridTracks(tracks: readonly GridTrack[], scale: number): GridTrack[] {
  return tracks.map((track) => ({
    ...track,
    value: track.sizing === 'FIXED' ? track.value * scale : track.value
  }))
}

function scaledVectorNetwork(
  vectorNetwork: SceneNode['vectorNetwork'],
  scale: number
): SceneNode['vectorNetwork'] {
  if (!vectorNetwork) return null
  const network = cloneVectorNetwork(vectorNetwork)
  for (const vertex of network.vertices) {
    vertex.x *= scale
    vertex.y *= scale
  }
  for (const segment of network.segments) {
    segment.tangentStart.x *= scale
    segment.tangentStart.y *= scale
    segment.tangentEnd.x *= scale
    segment.tangentEnd.y *= scale
  }
  return network
}

const times = (value: number, scale: number) => value * scale

type FieldScalers = {
  [K in keyof SceneNode]?: (value: SceneNode[K], scale: number) => SceneNode[K]
}

/** How each field that holds a length scales; fields absent here are dimensionless. */
const FIELD_SCALERS: FieldScalers = {
  width: times,
  height: times,
  minWidth: scaledOptional,
  maxWidth: scaledOptional,
  minHeight: scaledOptional,
  maxHeight: scaledOptional,
  cornerRadius: times,
  topLeftRadius: times,
  topRightRadius: times,
  bottomRightRadius: times,
  bottomLeftRadius: times,
  fontSize: times,
  letterSpacing: times,
  lineHeight: scaledOptional,
  textDecorationThickness: scaledOptional,
  textUnderlineOffset: scaledOptional,
  styleRuns: scaledStyleRuns,
  itemSpacing: times,
  counterAxisSpacing: times,
  paddingTop: times,
  paddingRight: times,
  paddingBottom: times,
  paddingLeft: times,
  gridColumnGap: times,
  gridRowGap: times,
  gridTemplateColumns: scaledGridTracks,
  gridTemplateRows: scaledGridTracks,
  strokes: scaledStrokes,
  strokeWeight: times,
  dashPattern: (pattern, scale) => pattern.map((value) => value * scale),
  borderTopWeight: times,
  borderRightWeight: times,
  borderBottomWeight: times,
  borderLeftWeight: times,
  effects: scaledEffects,
  fills: scaledFills,
  layoutGrids: scaledLayoutGrids,
  vectorNetwork: scaledVectorNetwork,
  fillGeometry: (paths, scale) => scaleGeometryPaths(paths, scale, scale),
  strokeGeometry: (paths, scale) => scaleGeometryPaths(paths, scale, scale)
}

const SCALED_FIELDS = Object.keys(FIELD_SCALERS) as (keyof SceneNode)[]

/** One field's value at `scale`; a dimensionless field comes back as given. */
export function scaleFieldValue<K extends keyof SceneNode>(
  field: K,
  value: SceneNode[K],
  scale: number
): SceneNode[K] {
  const scaler = FIELD_SCALERS[field] as
    | ((value: SceneNode[K], scale: number) => SceneNode[K])
    | undefined
  return scaler && scale !== 1 ? scaler(value, scale) : value
}

export function scaleNodeChanges(
  node: SceneNode,
  scale: number,
  scalePosition: boolean
): Partial<SceneNode> {
  const changes: Partial<SceneNode> = {
    x: scalePosition ? node.x * scale : node.x,
    y: scalePosition ? node.y * scale : node.y
  }
  for (const field of SCALED_FIELDS)
    Object.assign(changes, { [field]: FIELD_SCALERS[field]?.(node[field] as never, scale) })
  return changes
}
