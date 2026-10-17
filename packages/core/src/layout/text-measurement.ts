import type { SceneNode } from '@open-pencil/scene-graph'

import { PARAGRAPH_INPUT_KEYS } from '#core/canvas/text/paragraph/inputs'
import { fontManager, weightToStyle } from '#core/text/fonts'
import { measureTextWithOpenType } from '#core/text/opentype'

export type TextMeasurer = (
  node: SceneNode,
  maxWidth?: number
) => { width: number; height: number } | null

let globalTextMeasurer: TextMeasurer | null = null

const GLYPH_WIDTH_FACTOR = 0.6

/** Entries kept per measurer before the cache starts over. */
const MEASUREMENT_CACHE_LIMIT = 20_000

interface MeasurementCache {
  entries: Map<string, { width: number; height: number }>
  generation: number
  epoch: number
}

function createMeasurementCache(): MeasurementCache {
  return { entries: new Map(), generation: -1, epoch: -1 }
}

/** Bumped by {@link clearTextMeasurements}, so every cache reads as stale afterwards. */
let cacheEpoch = 0

/** Drops every cached measurement. A font change makes all of them stale. */
export function clearTextMeasurements(): void {
  cacheEpoch += 1
}

/**
 * Measures through `cache`, computing only what has not been measured since the fonts last
 * changed. A cache belongs to one measurer, because the same text measured by an estimate and by
 * shaped glyphs describes two different sizes.
 */
function cachedMeasurement(
  cache: MeasurementCache,
  measurer: TextMeasurer,
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } | null {
  const generation = fontManager.generation()
  if (generation !== cache.generation || cacheEpoch !== cache.epoch) {
    cache.entries.clear()
    cache.generation = generation
    cache.epoch = cacheEpoch
  }
  const key = measurementKey(node, maxWidth)
  const hit = cache.entries.get(key)
  if (hit) return hit

  const size = measurer(node, maxWidth)
  if (!size) return null
  if (cache.entries.size >= MEASUREMENT_CACHE_LIMIT) cache.entries.clear()
  cache.entries.set(key, size)
  return size
}

/**
 * What a measurement depends on, as one cache key: every field a paragraph is built from, and the
 * width the layout constrains it to. The paragraph fields are the list the renderer's own text
 * preparation invalidates on, so a run that carries its own style, a paragraph setting and a
 * decoration are part of the key instead of being mistaken for the same text.
 */
function measurementKey(node: SceneNode, maxWidth?: number): string {
  return [...PARAGRAPH_INPUT_KEYS.map((key) => fieldKey(node[key])), fieldKey(maxWidth)].join(
    '\u0000'
  )
}

/**
 * One field of a cache key: a string with the delimiter escaped, anything else as the JSON it
 * holds. Fields are joined with a NUL, so a NUL inside a value is doubled to keep it from reading
 * as the boundary between two fields.
 */
function fieldKey(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') return JSON.stringify(value)
  return value.replaceAll('\u0000', '\u0000\u0000')
}

const estimateCache = createMeasurementCache()

/** One cache per measurer, so no measurer is ever answered with another one's sizes. */
const installedCaches = new WeakMap<TextMeasurer, MeasurementCache>()

function installedCacheFor(measurer: TextMeasurer): MeasurementCache {
  const existing = installedCaches.get(measurer)
  if (existing) return existing
  const cache = createMeasurementCache()
  installedCaches.set(measurer, cache)
  return cache
}

export function estimateTextSize(
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } {
  const cached = cachedMeasurement(estimateCache, computeEstimateTextSize, node, maxWidth)
  return cached ?? computeEstimateTextSize(node, maxWidth)
}

function computeEstimateTextSize(
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } {
  const fontSize = node.fontSize || 14
  const family = node.fontFamily || 'Inter'
  const style = weightToStyle(node.fontWeight || 400, node.italic)
  const text = node.text || ''

  const explicitLineH = (node.lineHeight ?? 0) > 0 ? (node.lineHeight as number) : undefined
  const measured = measureTextWithOpenType(text, fontSize, family, style, maxWidth, explicitLineH)
  if (measured) return measured

  const charWidth = fontSize * GLYPH_WIDTH_FACTOR
  const singleLineWidth = Math.ceil(text.length * charWidth)
  const lineH = (node.lineHeight ?? 0) > 0 ? (node.lineHeight as number) : Math.ceil(fontSize * 1.4)

  if (maxWidth && maxWidth > 0 && singleLineWidth > maxWidth) {
    const lines = Math.ceil(singleLineWidth / maxWidth)
    return { width: maxWidth, height: Math.ceil(lines * lineH) }
  }
  return { width: singleLineWidth, height: lineH }
}

export function getTextMeasurer(): TextMeasurer | null {
  return globalTextMeasurer
}

export function setTextMeasurer(measurer: TextMeasurer | null): void {
  globalTextMeasurer = measurer
}

const installedMeasurers: TextMeasurer[] = []

/**
 * The size layout should use for `node`. A live measurer answers with shaped text, and its answers
 * are cached across nodes: instance clones repeat the same text, style and constraint, so a large
 * document asks for the same few shapes thousands of times. What cannot be measured is estimated.
 */
export function measureTextForLayout(
  node: SceneNode,
  maxWidth?: number
): { width: number; height: number } {
  const measurer = globalTextMeasurer
  if (!measurer) return estimateTextSize(node, maxWidth)
  return (
    cachedMeasurement(installedCacheFor(measurer), measurer, node, maxWidth) ??
    estimateTextSize(node, maxWidth)
  )
}

/**
 * Makes `measurer` the layout text measurer until the returned function uninstalls it. Then
 * the most recent measurer still installed takes over, so closing one editor neither leaves
 * layout measuring with its destroyed renderer nor keeps that editor alive.
 */
export function installTextMeasurer(measurer: TextMeasurer): () => void {
  installedMeasurers.push(measurer)
  globalTextMeasurer = measurer
  return () => {
    const index = installedMeasurers.lastIndexOf(measurer)
    if (index !== -1) installedMeasurers.splice(index, 1)
    if (globalTextMeasurer === measurer) globalTextMeasurer = installedMeasurers.at(-1) ?? null
  }
}

/**
 * Run `fn` with `measurer` as the layout text measurer. The measurer is shared, so `fn` must
 * be synchronous: an override held across an await would leak into other layouts.
 */
export function withTextMeasurer<T>(measurer: TextMeasurer, fn: () => T): T {
  const previous = globalTextMeasurer
  globalTextMeasurer = measurer
  try {
    return fn()
  } finally {
    globalTextMeasurer = previous
  }
}
