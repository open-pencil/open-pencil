import type { FeatureKind } from './content/features'

/**
 * Still images of each stage, captured from the built site by `tools/generate/landing-posters`
 * and shown until the live stage is ready. Kept free of Vue and the editor, so the generator
 * and server-rendered sections can import it.
 */
export const POSTER_THEMES = ['light', 'dark'] as const
export type PosterTheme = (typeof POSTER_THEMES)[number]

export const POSTER_LAYOUTS = ['desktop', 'phone'] as const
export type PosterLayout = (typeof POSTER_LAYOUTS)[number]

/**
 * A stage is captured as its canvas and its panel, because the stage's width follows the page
 * while the panel keeps its own: the canvas image scales to fit, as the live canvas fits its
 * scene, and the panel image stays as it is. The collaboration stage is two canvases, captured
 * as one frame.
 */
export type PosterPart = 'canvas' | 'panel' | 'frame'

/** Below this width a stage stacks its panel under the canvas, as Tailwind's `max-md` does. */
export const PHONE_MAX_WIDTH = 767

/** The query parameter the generator opens pages with: stages start at once and stay still. */
export const POSTER_CAPTURE_PARAM = 'poster-capture'

export function posterParts(kind: FeatureKind): PosterPart[] {
  return kind === 'collab' ? ['frame'] : ['canvas', 'panel']
}

export interface PosterTarget {
  /** Identifies the sources the posters were captured from, so a changed stage gets new URLs. */
  fingerprint: string
  /** The docs locale index: `root` for English, otherwise the locale's path prefix. */
  locale: string
  theme: PosterTheme
  layout: PosterLayout
}

/** The site path of one poster image, without the base. */
export function posterPath(target: PosterTarget, kind: FeatureKind, part: PosterPart): string {
  const { fingerprint, locale, theme, layout } = target
  return `landing-posters/${fingerprint}/${locale}/${theme}-${layout}/${kind}-${part}.webp`
}

export function isPosterCapture(): boolean {
  return (
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).has(POSTER_CAPTURE_PARAM)
  )
}
