import { invoke } from '@tauri-apps/api/core'
import { isValid, toUint8Array } from 'js-base64'
import * as v from 'valibot'

import type { BaselineTarget, CapturedPage, PageCapture } from './run'

/** The native command that draws a page outside the webview. */
export const CAPTURE_COMMAND = 'capture_page'

/** A page is a desktop screen until its frame says otherwise, as every frame opens. */
const DEFAULT_WIDTH = 1440
const DEFAULT_HEIGHT = 900

/** The sides a picture is taken at, which the native command enforces as well. */
const MIN_SIDE = 64
const MAX_SIDE = 4096

const pageShotSchema = v.object({
  bytes: v.pipe(v.string(), v.nonEmpty()),
  width: v.pipe(v.number(), v.integer(), v.minValue(1)),
  height: v.pipe(v.number(), v.integer(), v.minValue(1))
})

/** The native command, injected so a capture can be tested without a desktop build. */
export type CaptureTransport = (command: string, args?: Record<string, unknown>) => Promise<unknown>

/**
 * Whether an address is a page this machine serves. The rule matches the native command's, so a
 * frame that points at somebody else's site is refused here rather than driven out there.
 */
export function isLoopbackAddress(raw: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '[::1]') return true
  return /^127(?:\.\d{1,3}){3}$/.test(host)
}

/**
 * The size a page is drawn at: its frame's own size, kept within what the native command takes. A
 * frame with no size yet is drawn as a desktop screen.
 */
export function captureSize(target: BaselineTarget): { width: number; height: number } {
  return { width: side(target.width, DEFAULT_WIDTH), height: side(target.height, DEFAULT_HEIGHT) }
}

function side(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.min(MAX_SIDE, Math.max(MIN_SIDE, Math.round(value)))
}

/** The picture's bytes, or null when the text is not base64 at all. */
export function decodeBase64(text: string): Uint8Array | null {
  if (!isValid(text)) return null
  return toUint8Array(text)
}

/**
 * Take a page's picture on the desktop, where a browser the machine already has draws it. A
 * browser build, a page that is not on this machine, and a capture that failed all answer null:
 * the check then has nothing to compare instead of a picture that says nothing.
 */
export function desktopPageCapture(transport: CaptureTransport = invoke): PageCapture {
  return async (target) => {
    if (!isLoopbackAddress(target.url)) return null
    const { width, height } = captureSize(target)
    let raw: unknown
    try {
      raw = await transport(CAPTURE_COMMAND, { url: target.url, width, height })
    } catch (error) {
      // A missing command and a browser that refused both answer "no picture"; the console keeps
      // the reason, which the panel has no room for.
      console.warn('[Drift] The page could not be drawn:', error)
      return null
    }
    const shot = v.safeParse(pageShotSchema, raw)
    if (!shot.success) return null
    const bytes = decodeBase64(shot.output.bytes)
    if (bytes === null) return null
    const captured: CapturedPage = {
      bytes,
      width: shot.output.width,
      height: shot.output.height
    }
    return captured
  }
}
