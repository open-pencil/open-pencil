import { promiseTimeout } from '@vueuse/core'

const BOOT_SPLASH_ID = 'boot-splash'
/** The assembling mark ends 1.6s in; a background tab may hold its animations back, so cap the wait. */
const ANIMATION_WAIT_CAP_MS = 5000
const FADE_OUT_MS = 240

function markAssembled(splash: HTMLElement): Promise<unknown> {
  // Only the mark's own animations count: the loading bar's are for slow loads and may never end.
  const mark = splash.querySelector('svg')
  const animations = mark?.getAnimations({ subtree: true }) ?? []
  return Promise.allSettled(animations.map((animation) => animation.finished))
}

/**
 * Remove the boot splash once the app has mounted behind it. The mark plays its assembly in
 * full first, unless motion is reduced or the app runs under test or automation, where nothing
 * waits.
 */
export async function closeBootSplash(): Promise<void> {
  const splash = document.getElementById(BOOT_SPLASH_ID)
  if (!splash) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const underTest = navigator.webdriver || new URLSearchParams(window.location.search).has('test')
  if (!reducedMotion && !underTest) {
    await Promise.race([markAssembled(splash), promiseTimeout(ANIMATION_WAIT_CAP_MS)])
  }
  splash.dataset.state = 'closing'
  await promiseTimeout(reducedMotion || underTest ? 0 : FADE_OUT_MS)
  splash.remove()
}
