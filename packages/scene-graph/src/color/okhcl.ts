import { converter, toGamut } from 'culori'

import { copyFill, copyStroke } from '../copy'
import { readAllPluginData, withAllPluginData } from '../plugin-data/field'
import { OPEN_PENCIL_PLUGIN_DATA } from '../plugin-data/fields'
import type { Color } from '../primitives'
import type { ColorProfile, PluginDataEntry, SceneNode } from '../types'
import { fitsGamut } from './management'

export interface OkHCLColor {
  h: number
  c: number
  l: number
  a?: number
}

export interface OkHCLPayload {
  version: 1
  kind: 'fill' | 'stroke'
  index: number
  color: OkHCLColor
}

const toRGB = converter('rgb')
const toP3 = converter('p3')
const toOkHCL = converter('oklch')
const toDisplayableRGB = toGamut('rgb', 'oklch')
const toDisplayableP3 = toGamut('p3', 'oklch')

function clampUnit(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizeHue(value: number): number {
  const hue = value % 360
  return hue < 0 ? hue + 360 : hue
}

function normalizeOkHCLColor(color: OkHCLColor): OkHCLColor {
  return {
    h: normalizeHue(color.h),
    c: Math.max(0, color.c),
    l: clampUnit(color.l),
    a: clampUnit(color.a ?? 1)
  }
}

/**
 * `color` as components in `profile`, and whether the profile could not show it: a color past the
 * gamut is brought inside by reducing chroma, keeping lightness and hue. One that lands on the
 * gamut's edge, as every saturated primary does, counts as inside despite round-off.
 */
export function okhclInProfile(
  color: OkHCLColor,
  profile: ColorProfile
): { color: Color; clipped: boolean } {
  const normalized = normalizeOkHCLColor(color)
  const oklch = { mode: 'oklch' as const, l: normalized.l, c: normalized.c, h: normalized.h }
  const exact = profile === 'display-p3' ? toP3(oklch) : toRGB(oklch)
  const clipped = !fitsGamut(exact)
  const mapped = () =>
    profile === 'display-p3' ? toP3(toDisplayableP3(oklch)) : toRGB(toDisplayableRGB(oklch))
  const inside = clipped ? mapped() : exact
  return {
    color: {
      r: clampUnit(inside.r),
      g: clampUnit(inside.g),
      b: clampUnit(inside.b),
      a: normalized.a ?? 1
    },
    clipped
  }
}

/** Coordinates in `profile`, so callers can store colours in the document's profile. */
export function okhclToRGBA(color: OkHCLColor, profile: ColorProfile = 'srgb'): Color {
  return okhclInProfile(color, profile).color
}

/** Reads `color` as coordinates in `profile`, the inverse of {@link okhclToRGBA}. */
export function rgbaToOkHCL(color: Color, profile: ColorProfile = 'srgb'): OkHCLColor {
  const oklch = toOkHCL(
    profile === 'display-p3'
      ? { mode: 'p3', r: color.r, g: color.g, b: color.b, alpha: color.a }
      : { mode: 'rgb', r: color.r, g: color.g, b: color.b, alpha: color.a }
  )
  return normalizeOkHCLColor({
    h: oklch.h ?? 0,
    c: oklch.c,
    l: oklch.l,
    a: oklch.alpha ?? color.a
  })
}

export function serializeOkHCLPayload(payload: OkHCLPayload): string {
  return OPEN_PENCIL_PLUGIN_DATA.okhcl.encode(payload)
}

export function parseOkHCLPayload(value: string): OkHCLPayload | null {
  return OPEN_PENCIL_PLUGIN_DATA.okhcl.decode(value) ?? null
}

function createOkHCLPayload(
  kind: 'fill' | 'stroke',
  index: number,
  color: OkHCLColor
): OkHCLPayload {
  return {
    version: 1,
    kind,
    index,
    color: normalizeOkHCLColor(color)
  }
}

/** The node's plugin data with the payload for one paint replaced, or removed without `color`. */
function withOkHCLPayload(
  node: SceneNode,
  kind: 'fill' | 'stroke',
  index: number,
  color?: OkHCLColor
): PluginDataEntry[] {
  const payloads = getNodeOkHCLPayloads(node).filter(
    (payload) => payload.kind !== kind || payload.index !== index
  )
  if (color) payloads.push(createOkHCLPayload(kind, index, color))
  return withAllPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.okhcl, payloads)
}

export function setNodeFillOkHCL(
  node: SceneNode,
  index: number,
  color: OkHCLColor,
  profile: ColorProfile = 'srgb'
): Partial<SceneNode> {
  const fills = node.fills.map(copyFill)
  if (index < 0 || index >= fills.length) throw new Error(`Fill ${index} not found`)
  const fill = fills[index]
  const rgba = okhclToRGBA(color, profile)
  fills[index] = {
    ...fill,
    color: rgba,
    opacity: rgba.a
  }

  return {
    fills,
    pluginData: withOkHCLPayload(node, 'fill', index, color)
  }
}

export function setNodeStrokeOkHCL(
  node: SceneNode,
  index: number,
  color: OkHCLColor,
  profile: ColorProfile = 'srgb'
): Partial<SceneNode> {
  const strokes = node.strokes.map(copyStroke)
  if (index < 0 || index >= strokes.length) throw new Error(`Stroke ${index} not found`)
  const stroke = strokes[index]
  const rgba = okhclToRGBA(color, profile)
  strokes[index] = {
    ...stroke,
    color: rgba,
    opacity: rgba.a
  }

  return {
    strokes,
    pluginData: withOkHCLPayload(node, 'stroke', index, color)
  }
}

export function clearNodeFillOkHCL(node: SceneNode, index: number): Partial<SceneNode> {
  return { pluginData: withOkHCLPayload(node, 'fill', index) }
}

export function clearNodeStrokeOkHCL(node: SceneNode, index: number): Partial<SceneNode> {
  return { pluginData: withOkHCLPayload(node, 'stroke', index) }
}

export function getNodeOkHCLPayloads(node: SceneNode): OkHCLPayload[] {
  return readAllPluginData(node.pluginData, OPEN_PENCIL_PLUGIN_DATA.okhcl)
}

export function getFillOkHCL(node: SceneNode, index: number): OkHCLPayload | null {
  return (
    getNodeOkHCLPayloads(node).find(
      (payload) => payload.kind === 'fill' && payload.index === index
    ) ?? null
  )
}

export function getStrokeOkHCL(node: SceneNode, index: number): OkHCLPayload | null {
  return (
    getNodeOkHCLPayloads(node).find(
      (payload) => payload.kind === 'stroke' && payload.index === index
    ) ?? null
  )
}

/** Whether two colors differ by less than half a step of 8 bits in every component. */
function sameColor(left: Color, right: Color): boolean {
  const step = 1 / 510
  return (['r', 'g', 'b', 'a'] as const).every((key) => Math.abs(left[key] - right[key]) <= step)
}

/**
 * The OkHCL color a paint was last edited in, while it still makes the paint's stored color. The
 * stored color is what draws and what files keep; any other edit to it, such as a hex value, the
 * eyedropper, a plugin, or a new color profile, leaves the OkHCL value describing an older color.
 */
export function paintOkHCL(
  node: SceneNode,
  kind: 'fill' | 'stroke',
  index: number,
  profile: ColorProfile
): OkHCLColor | null {
  const payload = kind === 'fill' ? getFillOkHCL(node, index) : getStrokeOkHCL(node, index)
  const paint = index < 0 ? undefined : (kind === 'fill' ? node.fills : node.strokes).at(index)
  if (!payload || !paint) return null
  return sameColor(okhclToRGBA(payload.color, profile), paint.color) ? payload.color : null
}

/**
 * Keeps `color` as the OkHCL color a paint is edited in without changing the paint, for picking
 * the OkHCL format: the paint keeps its exact stored color.
 */
export function rememberPaintOkHCL(
  node: SceneNode,
  kind: 'fill' | 'stroke',
  index: number,
  color: OkHCLColor
): Partial<SceneNode> {
  return { pluginData: withOkHCLPayload(node, kind, index, color) }
}
