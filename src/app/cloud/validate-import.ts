import { unzipSync } from 'fflate'

export type DesignImportValidation =
  | { ok: true }
  | { ok: false; message: string }

const FIG_KIWI_MAGIC = 'fig-kiwi'
/** ZIP local-file / empty / spanned signatures (PK..) */
const ZIP_LOCAL_SIG = [0x50, 0x4b] as const

function isZipBytes(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 4 &&
    bytes[0] === ZIP_LOCAL_SIG[0] &&
    bytes[1] === ZIP_LOCAL_SIG[1]
  )
}

function hasFigKiwiMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 8) return false
  return new TextDecoder().decode(bytes.subarray(0, 8)) === FIG_KIWI_MAGIC
}

/** Pull canvas payload from a Figma ZIP the same way the core parser prefers. */
function extractFigCanvasBytes(zipBytes: Uint8Array): Uint8Array | null {
  let zip: Record<string, Uint8Array>
  try {
    zip = unzipSync(zipBytes, {
      filter: (file) =>
        file.name === 'canvas.fig' ||
        file.name === 'canvas' ||
        (file.name.startsWith('images/') && file.name !== 'images/')
    })
  } catch {
    return null
  }

  const entries = Object.keys(zip)
  for (const name of entries) {
    if (name === 'canvas.fig' || name === 'canvas') return zip[name] ?? null
  }

  let best: Uint8Array | null = null
  let maxSize = 0
  for (const name of entries) {
    const lower = name.toLowerCase()
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.json')) continue
    const entry = zip[name]
    if (!entry) continue
    if (entry.byteLength > maxSize) {
      maxSize = entry.byteLength
      best = entry
    }
  }
  return best
}

/**
 * Cheap structural check before cloud upload.
 * Real .fig files are a ZIP with a `fig-kiwi` canvas payload (or raw fig-kiwi).
 */
export function validateFigBytes(bytes: Uint8Array): DesignImportValidation {
  if (bytes.byteLength < 8) {
    return { ok: false, message: 'This is not a valid .fig file (file is too small).' }
  }

  if (isZipBytes(bytes)) {
    const canvas = extractFigCanvasBytes(bytes)
    if (!canvas) {
      return {
        ok: false,
        message: 'This is not a valid .fig file (missing canvas data).'
      }
    }
    if (!hasFigKiwiMagic(canvas)) {
      return {
        ok: false,
        message: 'This is not a valid .fig file (canvas is not fig-kiwi).'
      }
    }
    return { ok: true }
  }

  if (hasFigKiwiMagic(bytes)) return { ok: true }

  return {
    ok: false,
    message: 'This is not a valid .fig file (expected a Figma document).'
  }
}

/**
 * Cheap structural check: UTF-8 JSON object with a `children` array (Pencil .pen shape).
 */
export function validatePenBytes(bytes: Uint8Array): DesignImportValidation {
  if (bytes.byteLength === 0) {
    return { ok: false, message: 'This is not a valid .pen file (file is empty).' }
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return {
      ok: false,
      message: 'This is not a valid .pen file (not valid UTF-8 text).'
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, message: 'This is not a valid .pen file (invalid JSON).' }
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      message: 'This is not a valid .pen file (expected a JSON object).'
    }
  }

  const children = (parsed as { children?: unknown }).children
  if (!Array.isArray(children)) {
    return {
      ok: false,
      message: 'This is not a valid .pen file (missing a children array).'
    }
  }

  return { ok: true }
}

/** Validate import bytes by file extension (.fig / .pen). */
export function validateDesignImportBytes(
  fileName: string,
  bytes: Uint8Array
): DesignImportValidation {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.fig')) return validateFigBytes(bytes)
  if (lower.endsWith('.pen')) return validatePenBytes(bytes)
  return { ok: false, message: 'Only .fig and .pen files can be imported.' }
}
