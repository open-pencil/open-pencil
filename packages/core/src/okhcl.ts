import { converter } from 'culori'

import { normalizeColor } from './color'
import { copyFill, copyStroke } from './copy'

import type { SceneNode } from './scene-graph'
import type { Color } from './types'

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

const toRgb = converter('rgb')
const OKHCL_PLUGIN_KEY = 'okhcl'

function clampUnit(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizeHue(value: number): number {
  const hue = value % 360
  return hue < 0 ? hue + 360 : hue
}

export function okhclToRGBA(color: OkHCLColor): Color {
  const rgb = toRgb({
    mode: 'oklch',
    l: clampUnit(color.l),
    c: Math.max(0, color.c),
    h: normalizeHue(color.h),
    alpha: color.a ?? 1
  })
  return normalizeColor({
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: rgb.alpha ?? color.a ?? 1
  })
}

export function serializeOkHCLPayload(payload: OkHCLPayload): string {
  return JSON.stringify(payload)
}

export function parseOkHCLPayload(value: string): OkHCLPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<OkHCLPayload>
    if (parsed.version !== 1) return null
    if (parsed.kind !== 'fill' && parsed.kind !== 'stroke') return null
    if (typeof parsed.index !== 'number') return null
    if (!parsed.color) return null
    const color = parsed.color as Partial<OkHCLColor>
    if (typeof color.h !== 'number' || typeof color.c !== 'number' || typeof color.l !== 'number') {
      return null
    }
    return {
      version: 1,
      kind: parsed.kind,
      index: parsed.index,
      color: {
        h: color.h,
        c: color.c,
        l: color.l,
        a: typeof color.a === 'number' ? color.a : undefined
      }
    }
  } catch {
    return null
  }
}

function createOkHCLPayload(kind: 'fill' | 'stroke', index: number, color: OkHCLColor): OkHCLPayload {
  return {
    version: 1,
    kind,
    index,
    color: {
      h: normalizeHue(color.h),
      c: Math.max(0, color.c),
      l: clampUnit(color.l),
      a: color.a ?? 1
    }
  }
}

function filterOkHCLPayloads(entries: string[], kind: 'fill' | 'stroke', index: number): string[] {
  return entries.filter((entry) => {
    const payload = parseOkHCLPayload(entry)
    return !payload || payload.kind !== kind || payload.index !== index
  })
}

export function setNodeFillOkHCL(node: SceneNode, index: number, color: OkHCLColor): Partial<SceneNode> {
  const fills = node.fills.map(copyFill)
  if (index < 0 || index >= fills.length) throw new Error(`Fill ${index} not found`)
  const fill = fills[index]
  const rgba = okhclToRGBA(color)
  fills[index] = {
    ...fill,
    color: rgba,
    opacity: rgba.a
  }

  const payloads = filterOkHCLPayloads(node.pluginData.map((entry) => entry.value), 'fill', index)
  payloads.push(serializeOkHCLPayload(createOkHCLPayload('fill', index, color)))

  return {
    fills,
    pluginData: payloads.map((value) => ({ pluginId: 'open-pencil', key: OKHCL_PLUGIN_KEY, value }))
  }
}

export function setNodeStrokeOkHCL(node: SceneNode, index: number, color: OkHCLColor): Partial<SceneNode> {
  const strokes = node.strokes.map(copyStroke)
  if (index < 0 || index >= strokes.length) throw new Error(`Stroke ${index} not found`)
  const stroke = strokes[index]
  const rgba = okhclToRGBA(color)
  strokes[index] = {
    ...stroke,
    color: rgba,
    opacity: rgba.a
  }

  const payloads = filterOkHCLPayloads(node.pluginData.map((entry) => entry.value), 'stroke', index)
  payloads.push(serializeOkHCLPayload(createOkHCLPayload('stroke', index, color)))

  return {
    strokes,
    pluginData: payloads.map((value) => ({ pluginId: 'open-pencil', key: OKHCL_PLUGIN_KEY, value }))
  }
}

export function getNodeOkHCLPayloads(node: SceneNode): OkHCLPayload[] {
  return node.pluginData
    .filter((entry) => entry.pluginId === 'open-pencil' && entry.key === OKHCL_PLUGIN_KEY)
    .map((entry) => parseOkHCLPayload(entry.value))
    .filter((payload): payload is OkHCLPayload => payload !== null)
}

export function getFillOkHCL(node: SceneNode, index: number): OkHCLPayload | null {
  return getNodeOkHCLPayloads(node).find((payload) => payload.kind === 'fill' && payload.index === index) ?? null
}

export function getStrokeOkHCL(node: SceneNode, index: number): OkHCLPayload | null {
  return getNodeOkHCLPayloads(node).find((payload) => payload.kind === 'stroke' && payload.index === index) ?? null
}
