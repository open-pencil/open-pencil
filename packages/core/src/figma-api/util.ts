/// <reference types="@figma/plugin-typings" />

import { clampRgb as clampRGB, converter, parse, type Color as CuloriColor } from 'culori'

import { invalid, received } from './accessors/text/messages'

const toRGB = converter('rgb')

/** The CSS color spaces Figma's `figma.util` reads; it refuses `lch()`, `hwb()`, and the rest. */
const READABLE_MODES = new Set(['rgb', 'hsl', 'lab', 'oklab', 'oklch', 'p3'])

/** The order Figma lists blend modes in when it refuses one. */
const BLEND_MODES = [
  'PASS_THROUGH',
  'NORMAL',
  'DARKEN',
  'MULTIPLY',
  'LINEAR_BURN',
  'COLOR_BURN',
  'LIGHTEN',
  'SCREEN',
  'LINEAR_DODGE',
  'COLOR_DODGE',
  'OVERLAY',
  'SOFT_LIGHT',
  'HARD_LIGHT',
  'DIFFERENCE',
  'EXCLUSION',
  'HUE',
  'SATURATION',
  'COLOR',
  'LUMINOSITY'
] as const satisfies readonly BlendMode[]

const SOLID_PAINT_KEYS = new Set([
  'type',
  'color',
  'visible',
  'opacity',
  'blendMode',
  'boundVariables'
])

/** What Figma's messages call a value of the wrong type; unlike text styles, it says `NaN`. */
function kind(value: unknown): string {
  return typeof value === 'number' && Number.isNaN(value) ? 'NaN' : received(value)
}

/** Figma's complaint about a channel from 0 to 1, or null when `value` is one. */
function channelProblem(value: unknown, at = ''): string | null {
  if (value === undefined) return `Required value missing${at}`
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return `Expected number, received ${kind(value)}${at}`
  }
  if (value > 1) return `Too big: expected number to be <=1${at}`
  if (value < 0) return `Too small: expected number to be >=0${at}`
  return null
}

function unrecognizedKeys(value: object, known: ReadonlySet<string>): string | null {
  const unknown = Object.keys(value).filter((key) => !known.has(key))
  if (unknown.length === 0) return null
  const names = unknown.map((key) => `"${key}"`).join(', ')
  return unknown.length === 1 ? `Unrecognized key: ${names}` : `Unrecognized keys: ${names}`
}

/**
 * A CSS color string as Figma reads it: clipped to sRGB channel by channel, and `lab()` taken
 * with a D65 white rather than CSS's D50.
 */
function readColorString(method: string, input: string): RGBA {
  const parsed = parse(input.trim())
  // Figma refuses CSS `none` channels, which culori reads by leaving the channel out.
  if (!parsed || !READABLE_MODES.has(parsed.mode) || /\bnone\b/i.test(input)) {
    throw new Error(`in ${method}: failed to parse color: ${input}`)
  }
  const color: CuloriColor = parsed.mode === 'lab' ? { ...parsed, mode: 'lab65' } : parsed
  const { r, g, b } = clampRGB(toRGB(color))
  return { r, g, b, a: Math.min(Math.max(parsed.alpha ?? 1, 0), 1) }
}

const RGBA_KEYS = new Set(['r', 'g', 'b', 'a'])

/** `color` as `figma.util` takes it: a CSS color string, or an RGB or RGBA object. */
function readColor(method: string, color: unknown): RGBA {
  if (typeof color === 'string') return readColorString(method, color)
  const fail = (problem: string) => invalid(method, problem, 'color')
  if (color === undefined) {
    throw fail('Expected one of the following, but none matched:\n  Required value missing')
  }
  if (typeof color !== 'object' || color === null || Array.isArray(color)) {
    const type = kind(color)
    throw fail(
      'Expected one of the following, but none matched:\n' +
        `  Expected string, received ${type}\n  Expected object, received ${type}`
    )
  }
  const unknown = unrecognizedKeys(color, RGBA_KEYS)
  if (unknown) throw fail(unknown)
  const channels: Record<string, unknown> = { ...color }
  const problems = (['r', 'g', 'b', 'a'] as const).flatMap((key) => {
    if (key === 'a' && channels.a === undefined) return []
    return channelProblem(channels[key], ` at .${key}`) ?? []
  })
  if (problems.length > 0) throw fail(problems.join('\n'))
  // Every channel is a number from 0 to 1 now.
  const channel = (key: keyof RGBA) => Number(channels[key] ?? 1)
  return { r: channel('r'), g: channel('g'), b: channel('b'), a: channel('a') }
}

function rgb(color: string | RGB | RGBA): RGB {
  const { r, g, b } = readColor('rgb', color)
  return { r, g, b }
}

function rgba(color: string | RGB | RGBA, alphaOverride?: number): RGBA {
  const parsed = readColor('rgba', color)
  if (alphaOverride === undefined) return parsed
  const problem = channelProblem(alphaOverride)
  if (problem) throw invalid('rgba', problem, 'alphaOverride')
  return { ...parsed, a: alphaOverride }
}

/** Figma's complaint about `overrides` for a solid paint, or null when it takes them. */
function overridesProblem(overrides: unknown): string | null {
  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
    return `Expected object, received ${kind(overrides)}`
  }
  const unknown = unrecognizedKeys(overrides, SOLID_PAINT_KEYS)
  if (unknown) return unknown
  const type = 'type' in overrides ? overrides.type : undefined
  const visible = 'visible' in overrides ? overrides.visible : undefined
  const blendMode = 'blendMode' in overrides ? overrides.blendMode : undefined
  if (type !== undefined && type !== 'SOLID') return 'Invalid input: expected "SOLID" at .type'
  if (visible !== undefined && typeof visible !== 'boolean') {
    return `Expected boolean, received ${kind(visible)} at .visible`
  }
  if (blendMode !== undefined && !(BLEND_MODES as readonly unknown[]).includes(blendMode)) {
    const expected = BLEND_MODES.map((mode) => `"${mode}"`).join('|')
    return `Invalid option: expected one of ${expected} at .blendMode`
  }
  return null
}

/**
 * A solid paint of `color` with its alpha as the opacity, keeping the other properties of
 * `overrides`. The color and its alpha win over `overrides`, as in Figma, so an existing paint
 * takes the new color and opacity.
 */
function solidPaint(color: string | RGB | RGBA, overrides?: Partial<SolidPaint>): SolidPaint {
  const { r, g, b, a } = readColor('solidPaint', color)
  if (overrides !== undefined) {
    const problem = overridesProblem(overrides)
    if (problem) throw invalid('solidPaint', problem, 'SolidPaint')
  }
  return { ...overrides, type: 'SOLID', color: { r, g, b }, opacity: a }
}

/** Figma normalizes for its rich-text editors, which OpenPencil does not have. */
function normalizeMarkdown(): string {
  throw new Error('in normalizeMarkdown: OpenPencil does not support rich-text Markdown')
}

/** Figma's `figma.util`, whose functions a script may call detached (`const rgb = figma.util.rgb`). */
export const figmaUtil: UtilAPI = Object.freeze({ rgb, rgba, solidPaint, normalizeMarkdown })
