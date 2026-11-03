import { useMutationObserver } from '@vueuse/core'
import { shallowRef } from 'vue'

const DEFAULT_ROOT_FONT_SIZE = 16

function readRootFontSize(): number {
  if (typeof document === 'undefined') return DEFAULT_ROOT_FONT_SIZE
  const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(size) && size > 0 ? size : DEFAULT_ROOT_FONT_SIZE
}

/**
 * What 1rem is, in CSS pixels. Interface sizes are in rem so the whole interface follows the root
 * font size; this tracks it for the geometry script has to compute in pixels.
 */
export const rootFontSize = shallowRef(readRootFontSize())

if (typeof document !== 'undefined') {
  useMutationObserver(
    document.documentElement,
    () => {
      rootFontSize.value = readRootFontSize()
    },
    { attributes: true }
  )
}

/** `rem` in CSS pixels at the current root font size. */
export function remToPx(rem: number): number {
  return rem * rootFontSize.value
}
