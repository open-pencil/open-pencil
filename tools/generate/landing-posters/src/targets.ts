import { LOCALE_PREFIXES } from '#docs-config/seo'
import { FEATURE_KINDS } from '#docs-config/theme/landing/content/features'
import {
  POSTER_LAYOUTS,
  POSTER_THEMES,
  posterParts,
  posterPath,
  type PosterTarget
} from '#docs-config/theme/landing/posters'

/** One of `count` parts of the capture, numbered from 1, so CI can spread it over runners. */
export interface PosterShard {
  index: number
  count: number
}

const SHARD = /^([1-9]\d*)\/([1-9]\d*)$/

/** Reads `index/count`, such as `2/4`. */
export function parseShard(text: string): PosterShard {
  const match = SHARD.exec(text)
  const index = Number(match?.[1])
  const count = Number(match?.[2])
  if (!match || index > count) {
    throw new Error(`Invalid shard "${text}": write index/count with 1 <= index <= count`)
  }
  return { index, count }
}

/** Every page captured: each locale's landing in each theme and layout. */
export function posterTargets(fingerprint: string): PosterTarget[] {
  return ['root', ...LOCALE_PREFIXES].flatMap((locale) =>
    POSTER_THEMES.flatMap((theme) =>
      POSTER_LAYOUTS.map((layout) => ({ fingerprint, locale, theme, layout }))
    )
  )
}

/** The pages one shard captures; the shards of a count together take every page once. */
export function shardTargets(targets: PosterTarget[], shard: PosterShard): PosterTarget[] {
  return targets.filter((_, position) => position % shard.count === shard.index - 1)
}

/** The site paths of every still captured of one page. */
export function posterFiles(target: PosterTarget): string[] {
  return FEATURE_KINDS.flatMap((kind) =>
    posterParts(kind).map((part) => posterPath(target, kind, part))
  )
}
