import { IS_TAURI } from '@open-pencil/core/constants'

import { missingSupportSentinels } from './baseline'
import { describeEnvironment, type DesktopFacts, type SupportEnvironment } from './detect'
import { bootFailureNotice, unsupportedNotice } from './guidance'
import { renderSupportNotice } from './render'

async function desktopFacts(): Promise<DesktopFacts> {
  try {
    const [{ platform, version }, { invoke }] = await Promise.all([
      import('@tauri-apps/plugin-os'),
      import('@tauri-apps/api/core')
    ])
    const webviewVersion = await invoke<string | null>('webview_version').catch(() => null)
    return {
      platform: platform(),
      osVersion: version(),
      webviewVersion: webviewVersion ?? undefined
    }
  } catch (error) {
    // The notice still helps without native facts; fall back to the user agent.
    console.warn('[support] desktop facts unavailable', error)
    return { platform: 'unknown' }
  }
}

async function detectEnvironment(): Promise<SupportEnvironment> {
  const facts = { userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints }
  return describeEnvironment(facts, IS_TAURI ? await desktopFacts() : undefined)
}

/**
 * Check the engine against the support baseline before the app bundle loads.
 * Returns `true` when the app may boot; otherwise the app root now shows
 * platform-specific update guidance and the caller must stop.
 */
export async function runSupportGate(): Promise<boolean> {
  const missing = missingSupportSentinels()
  if (missing.length === 0) return true
  renderSupportNotice(unsupportedNotice(await detectEnvironment(), missing))
  return false
}

/** Replace a blank window with an explanation after the app failed to load. */
export async function reportBootFailure(error: unknown): Promise<void> {
  console.error('[support] boot failed', error)
  renderSupportNotice(bootFailureNotice(await detectEnvironment(), error))
}
