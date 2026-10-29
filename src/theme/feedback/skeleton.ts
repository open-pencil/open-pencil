/**
 * Grey bars in the place of content that is still loading. A group of them fades in only after a
 * moment (`group`), so content that arrives quickly replaces nothing, and each bar pulses unless
 * motion is reduced.
 */
const skeletonTheme = {
  slots: {
    group:
      'animate-in fade-in fill-mode-backwards delay-150 duration-200 motion-reduce:animate-none',
    bar: 'block h-2.5 animate-pulse rounded bg-panel-field motion-reduce:animate-none'
  }
} as const

export type SkeletonTheme = typeof skeletonTheme
export default skeletonTheme
