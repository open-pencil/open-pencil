import { converter } from 'culori'

import { colorDistance } from '@lawha/scene-graph/color'
import type { Color } from '@lawha/scene-graph/primitives'

import type { ColorUse, Extracted, TypeSample, Use } from './extract'

const toOKLCH = converter('oklch')

/** Colours closer than this (RGB, 0–441) are one token: a hand-picked near-duplicate. */
export const NEAR_DUPLICATE = 6

export interface ColorToken {
  name: string
  color: Color
  /** Layers using exactly this colour. */
  uses: ColorUse[]
  /** Layers using a near-duplicate, which normalising snaps to this token. */
  nearUses: ColorUse[]
  /** The near-duplicates found, as hex, for the report. */
  variants: string[]
}

export interface NumberToken {
  name: string
  value: number
  uses: Use[]
}

export interface TypeToken {
  name: string
  sample: TypeSample
  uses: Use[]
}

export interface Plan {
  colors: ColorToken[]
  type: TypeToken[]
  families: { name: string; family: string }[]
  spacing: NumberToken[]
  radius: NumberToken[]
}

function oklch(color: Color) {
  const c = toOKLCH({ mode: 'rgb', r: color.r, g: color.g, b: color.b })
  return { l: c.l, c: c.c, h: c.h ?? 0 }
}

const isNeutral = (color: Color) => oklch(color).c < 0.04

interface Cluster {
  color: Color
  hex: string
  uses: ColorUse[]
  nearUses: ColorUse[]
  variants: string[]
}

/** Groups near-duplicate colours under the most used one. */
function cluster(extracted: Extracted): Cluster[] {
  const entries = [...extracted.colors.entries()].sort(
    (a, b) => b[1].uses.length - a[1].uses.length
  )
  const clusters: Cluster[] = []
  for (const [hex, { color, uses }] of entries) {
    const home = clusters.find(
      (c) => Math.abs(c.color.a - color.a) < 0.02 && colorDistance(c.color, color) < NEAR_DUPLICATE
    )
    if (home) {
      home.nearUses.push(...uses)
      home.variants.push(hex)
    } else clusters.push({ color, hex, uses: [...uses], nearUses: [], variants: [] })
  }
  return clusters
}

const weight = (uses: readonly ColorUse[]) => uses.length
const area = (uses: readonly ColorUse[]) => uses.reduce((sum, u) => sum + u.area, 0)
const textCount = (uses: readonly ColorUse[]) => uses.filter((u) => u.text).length

/**
 * Names colours by role: the biggest fill on the screens is the background, the most used text
 * colours are text, saturated colours become brand colours by use, and the remaining greys form
 * a neutral scale named by lightness (neutral/50 lightest … neutral/900 darkest).
 */
function nameColors(extracted: Extracted): ColorToken[] {
  const clusters = cluster(extracted)
  const named = new Map<Cluster, string>()
  const all = (c: Cluster) => [...c.uses, ...c.nearUses]
  const take = (c: Cluster | undefined, name: string) => {
    if (c && !named.has(c)) named.set(c, name)
  }
  const rootFills = clusters
    .map((c) => ({
      c,
      a: all(c)
        .filter((u) => extracted.roots.includes(u.node))
        .reduce((s, u) => s + u.area, 0)
    }))
    .filter((x) => x.a > 0)
    .sort((x, y) => y.a - x.a)
  take(rootFills[0]?.c, 'color/background')
  const texts = clusters
    .filter((c) => textCount(all(c)) > 0)
    .sort((a, b) => textCount(all(b)) - textCount(all(a)))
  take(texts[0], 'color/text/primary')
  take(
    texts.find((c) => !named.has(c)),
    'color/text/secondary'
  )
  const brand = clusters
    .filter((c) => !named.has(c) && !isNeutral(c.color))
    .sort((a, b) => weight(all(b)) - weight(all(a)) || area(all(b)) - area(all(a)))
  const brandNames = ['color/primary', 'color/secondary', 'color/accent']
  brand.forEach((c, i) => take(c, i < brandNames.length ? brandNames[i] : `color/accent-${i - 1}`))
  const neutrals = clusters
    .filter((c) => !named.has(c))
    .sort((a, b) => oklch(b.color).l - oklch(a.color).l)
  const used = new Set<string>()
  for (const c of neutrals) {
    const l = oklch(c.color).l
    // Lightness 1 → 50, 0 → 900, on the familiar 50/100…900 steps.
    let step = Math.max(50, Math.min(900, Math.round((1 - l) * 9) * 100 || 50))
    while (used.has(`${step}`)) step += step < 900 ? 50 : 1
    used.add(`${step}`)
    take(c, `color/neutral/${step}`)
  }
  return clusters.map((c) => ({
    name: named.get(c) ?? 'color/other',
    color: c.color,
    uses: c.uses,
    nearUses: c.nearUses,
    variants: c.variants
  }))
}

const TYPE_NAMES = ['display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']

/** The most used text style is body; larger ones are headings by size, smaller ones caption. */
function nameType(extracted: Extracted): TypeToken[] {
  const entries = [...extracted.type.values()]
  if (entries.length === 0) return []
  const body = [...entries].sort((a, b) => b.uses.length - a.uses.length)[0]
  const larger = entries
    .filter((e) => e.sample.size > body.sample.size)
    .sort((a, b) => b.sample.size - a.sample.size)
  const smaller = entries
    .filter((e) => e !== body && e.sample.size <= body.sample.size)
    .sort((a, b) => b.sample.size - a.sample.size)
  // With few heading sizes, start at h1; keep display for a size well above the rest.
  const headingNames =
    larger.length > 0 && larger[0].sample.size >= 40 ? TYPE_NAMES : TYPE_NAMES.slice(1)
  const tokens: TypeToken[] = []
  larger.forEach((e, i) =>
    tokens.push({ name: headingNames[i] ?? `heading-${i + 1}`, sample: e.sample, uses: e.uses })
  )
  tokens.push({ name: 'body', sample: body.sample, uses: body.uses })
  smaller.forEach((e, i) => {
    let name = 'caption'
    if (e.sample.size === body.sample.size)
      name = e.sample.weight > body.sample.weight ? 'body-strong' : 'body-alt'
    else if (i > 0) name = `small-${i}`
    tokens.push({ name, sample: e.sample, uses: e.uses })
  })
  const seen = new Map<string, number>()
  return tokens.map((t) => {
    const n = seen.get(t.name) ?? 0
    seen.set(t.name, n + 1)
    return n === 0 ? t : { ...t, name: `${t.name}-${n + 1}` }
  })
}

function nameNumbers(map: Map<number, Use[]>, prefix: string): NumberToken[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, uses]) => ({
      name: `${prefix}/${value >= 999 ? 'full' : Math.round(value * 100) / 100}`,
      value,
      uses
    }))
}

export function plan(extracted: Extracted): Plan {
  const type = nameType(extracted)
  const familyCount = new Map<string, number>()
  for (const t of type)
    familyCount.set(t.sample.family, (familyCount.get(t.sample.family) ?? 0) + t.uses.length)
  const familyNames = ['font/primary', 'font/secondary', 'font/tertiary']
  const families = [...familyCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([family], i) => ({ name: familyNames[i] ?? `font/${i + 1}`, family }))
  return {
    colors: nameColors(extracted),
    type,
    families,
    spacing: nameNumbers(extracted.spacing, 'space'),
    radius: nameNumbers(extracted.radius, 'radius')
  }
}
