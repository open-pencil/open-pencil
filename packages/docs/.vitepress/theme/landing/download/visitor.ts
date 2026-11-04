import { onMounted, shallowRef, type ShallowRef } from 'vue'

import type { Arch, Platform } from './releases'

export interface VisitorSystem {
  platform: Platform | null
  /** Only what the browser reports; Safari never says which processor a Mac has. */
  arch: Arch | null
}

/** The desktop platform a browser runs on, from its user agent and how many touches it takes. */
export function platformOf(userAgent: string, touchPoints: number): Platform | null {
  // Phones and tablets get the full list rather than a desktop installer. An iPad asks for
  // desktop sites as a Mac does, but no Mac has a touch screen.
  if (/Android|iPhone|iPad/.test(userAgent)) return null
  if (/Mac OS X|Macintosh/.test(userAgent)) return touchPoints > 1 ? null : 'mac'
  if (/Windows/.test(userAgent)) return 'windows'
  if (/Linux|X11/.test(userAgent)) return 'linux'
  return null
}

/** The processor architecture from User-Agent Client Hints, which Chromium browsers offer. */
async function reportedArch(): Promise<Arch | null> {
  const hints: unknown = Reflect.get(navigator, 'userAgentData')
  const request: unknown =
    typeof hints === 'object' && hints !== null ? Reflect.get(hints, 'getHighEntropyValues') : null
  if (typeof request !== 'function') return null
  try {
    const values: unknown = await Reflect.apply(request, hints, [['architecture']])
    const architecture =
      typeof values === 'object' && values !== null ? Reflect.get(values, 'architecture') : null
    if (architecture === 'arm') return 'arm64'
    if (architecture === 'x86') return 'x64'
  } catch {
    return null
  }
  return null
}

/**
 * The visitor's system, once the page runs in the browser; null while it is rendered ahead of
 * time, which has no visitor.
 */
export function useVisitorSystem(): ShallowRef<VisitorSystem | null> {
  const system = shallowRef<VisitorSystem | null>(null)
  onMounted(async () => {
    // The platform shows at once; a processor the browser reports refines the choice later.
    const platform = platformOf(navigator.userAgent, navigator.maxTouchPoints)
    system.value = { platform, arch: null }
    const arch = await reportedArch()
    if (arch) system.value = { platform, arch }
  })
  return system
}
